import ctypes
import os
import selectors
import signal
import socket


def adopt_forkserver_descendants():
    # Linux reparents orphans of our workers here instead of leaving their reap to PID 1.
    # The selector only waits on registered leaders and adoptees of their confirmed groups.
    libc = ctypes.CDLL(None, use_errno=True)
    if libc.prctl(36, 1, 0, 0, 0) != 0:  # PR_SET_CHILD_SUBREAPER
        err = ctypes.get_errno()
        raise OSError(err, os.strerror(err))


class ForkserverCell:
    def __init__(self, selector, generation, cell_id, status, pid, handshake):
        self.selector, self.generation, self.cell_id = selector, generation, cell_id
        self.status, self.pid, self.handshake = status, pid, handshake
        self.confirmed = self.forked = self.cancelled = self.proved = self.committed = False
        self.exit_code = None
        handshake.setblocking(False)
        selector.register(handshake, selectors.EVENT_READ)
        selector.register(status, selectors.EVENT_READ)

    def close_status(self):
        if self.status is not None:
            self.selector.unregister(self.status)
            self.status.close()
            self.status = None

    def close_handshake(self):
        if self.handshake is not None:
            self.selector.unregister(self.handshake)
            self.handshake.close()
            self.handshake = None

    def send(self, kind, **fields):
        if self.status is not None:
            if send_forkserver_packet(self.status, self.generation, self.cell_id, kind=kind, **fields):
                return True
            self.close_status()
        return False

    def check_status_closed(self):
        if self.status is not None:
            try:
                if not self.status.recv(1, socket.MSG_PEEK):
                    self.close_status()
            except BlockingIOError:
                pass
            except OSError:
                self.close_status()

    def receive_commit(self, fenced):
        if self.status is None:
            return
        try:
            raw, _, flags, _ = self.status.recvmsg(4096)
            if flags & (socket.MSG_TRUNC | socket.MSG_CTRUNC):
                raise ValueError("truncated forkserver commit")
            _, cell_id = parse_forkserver_request(raw, self.generation, ("commit",))
            if cell_id != self.cell_id:
                raise ValueError("mismatched forkserver commit")
        except BlockingIOError:
            return
        except (OSError, ValueError, RecursionError):
            self.close_status()
            return
        accepted = self.proved and self.forked and not self.cancelled and not fenced
        if self.send("commit", accepted=accepted) and accepted:
            self.committed = True

    def release(self):
        if self.handshake is None:
            return
        try:
            self.confirmed = self.handshake.recv(1) == b"1" and os.getpgid(self.pid) == os.getsid(self.pid) == self.pid
        except BlockingIOError:
            return
        except OSError:
            self.confirmed = False
        try:
            if self.confirmed and self.send("forked", pid=self.pid, pgid=self.pid, threads=1):
                self.forked = True
                self.handshake.send(b"1", socket.MSG_NOSIGNAL)
        except OSError:
            pass  # The child may have exited between confirmation and release.
        finally:
            self.close_handshake()

    def signal_group(self):
        # Only called for a confirmed group with its direct leader still unreaped.
        try:
            os.killpg(self.pid, signal.SIGKILL)
        except (ProcessLookupError, PermissionError):
            pass  # Only the subsequent wait and group-absence proof count.

    def cancel(self):
        if not self.cancelled and not self.committed:
            self.cancelled = True
            self.close_handshake()  # EOF, never a run token, for a pending child.
            if self.confirmed and self.exit_code is None:
                self.signal_group()

    def reap(self, leaders):
        if self.proved or self.handshake is not None:
            return
        if self.exit_code is None:
            exited = os.waitid(os.P_PID, self.pid, os.WEXITED | os.WNOWAIT | os.WNOHANG)
            if exited is None:
                return
            # Pin the exited leader through the final signal, even on a natural exit.
            if self.confirmed:
                self.signal_group()
            waited, status = os.waitpid(self.pid, os.WNOHANG)
            if not waited:
                return
            leaders.remove(self.pid)
            self.exit_code = os.waitstatus_to_exitcode(status)
        if self.confirmed and not self.group_absent(leaders):
            return
        self.proved = True
        if self.forked:
            self.send("exited", exitCode=self.exit_code, cancelled=self.cancelled)
        elif self.cancelled:
            self.send("cancelled")
            self.close_status()
        elif self.status is not None:
            reject_forkserver_cell(self.status, self.generation, self.cell_id,
                                   "fork child did not establish its private process group", 1)
            self.close_status()

    def group_absent(self, leaders):
        # After reaping the leader we never signal again. Reap only adopted zombies
        # from the original group, never a registered leader if the number was reused.
        if self.pid not in leaders:
            for _ in range(16):
                try:
                    child = os.waitid(os.P_PGID, self.pid, os.WEXITED | os.WNOWAIT | os.WNOHANG)
                except ChildProcessError:
                    break
                if child is None or child.si_pid in leaders:
                    break
                os.waitpid(child.si_pid, os.WNOHANG)
        try:
            os.killpg(self.pid, 0)
        except ProcessLookupError:
            return True
        except PermissionError:
            pass
        return False

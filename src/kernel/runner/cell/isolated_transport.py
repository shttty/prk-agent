import array
from contextlib import contextmanager, ExitStack
import json
from multiprocessing.connection import Connection, wait
import os
import socket
import struct
import time


class _IsolatedRejection(Exception):
    def __init__(self, code, reason):
        super().__init__(reason)
        self.code = code


def _isolated_rejection(code, reason):
    # Bound both the gateway's UTF-16 count and the escaped JSON frame.
    return "rejected", {"code": code, "reason": reason[:640]}


def cancel_isolated_fork(ctx, cell_id):
    # Reader holds the gate for both the cancellation mark and fork submission.
    if ctx.forkserver is None or not 0 < len(cell_id) <= 128:
        return
    packet = json.dumps(dict(kind="cancel", generation=ctx.generation, cellId=cell_id)).encode()
    try:
        ctx.forkserver.send(packet, socket.MSG_DONTWAIT | socket.MSG_NOSIGNAL)
    except OSError:
        # No receipt here. A live worker still requires the forkserver's exit proof.
        pass


@contextmanager
def open_isolated_transport(ctx, cell):
    if ctx.forkserver is None:
        raise _IsolatedRejection("ISOLATION_UNAVAILABLE", "No forkserver control channel")
    packet = json.dumps(dict(kind="fork", generation=ctx.generation, cellId=cell.id)).encode()
    if not 0 < len(cell.id) <= 128 or len(packet) > 4096:
        raise _IsolatedRejection("INVALID_REQUEST", "Invalid isolated cell identity")
    with ExitStack() as stack:
        with ExitStack() as handoff:
            status, child_status = socket.socketpair(socket.AF_UNIX, socket.SOCK_SEQPACKET)
            stack.enter_context(status)
            handoff.enter_context(child_status)
            data, child_data = socket.socketpair(socket.AF_UNIX, socket.SOCK_STREAM)
            stack.enter_context(data)
            handoff.enter_context(child_data)
            start_ms = ctx.options["startTimeoutMs"]
            # wait() handles idle endpoints. These native timeouts bound a stalled
            # Connection read/write in the middle of a frame if the peer dies.
            seconds, millis = divmod(start_ms, 1000)
            timeout = struct.pack("@ll", seconds, millis * 1000)
            data.setsockopt(socket.SOL_SOCKET, socket.SO_RCVTIMEO, timeout)
            data.setsockopt(socket.SOL_SOCKET, socket.SO_SNDTIMEO, timeout)
            stream = stack.enter_context(Connection(data.detach()))
            transport = _IsolatedTransport(ctx, cell, status, stream)
            fds = array.array("i", [child_status.fileno(), child_data.fileno()])
            with ctx.condition:
                check_cancelled(ctx, cell)
                try:
                    written = ctx.forkserver.sendmsg([packet], [(socket.SOL_SOCKET, socket.SCM_RIGHTS, fds)],
                                                     socket.MSG_DONTWAIT)
                except BlockingIOError as error:
                    raise _IsolatedRejection("BUSY", "Forkserver control is full") from error
                if written != len(packet):
                    raise OSError("Incomplete forkserver request")
        try:
            yield transport
        except (KeyboardInterrupt, EOFError, OSError, ValueError, _IsolatedRejection) as error:
            if transport.forked and not ctx.eof:
                try:
                    transport.drain_after_error()
                except (EOFError, OSError, ValueError):
                    transport.wait_for_retirement()
            elif cell.cancelled and isinstance(error, (EOFError, OSError, ValueError)) and not ctx.eof:
                transport.wait_for_retirement()
            if transport.cancelled:
                raise KeyboardInterrupt() from None
            raise


class _IsolatedTransport:
    def __init__(self, ctx, cell, status, stream):
        self.ctx, self.cell = ctx, cell
        self.status, self.stream = status, stream
        self.deadline = time.monotonic() + ctx.options["startTimeoutMs"] / 1000
        self.forked = False
        self.exit_code = None
        self.cancelled = False
        self.data_done = False

    def _check_live(self):
        with self.ctx.condition:
            if self.ctx.eof:
                raise KeyboardInterrupt()
            return self.cell.cancelled

    def _read_status(self):
        raw, _, flags, _ = self.status.recvmsg(65536)
        if not raw or flags & socket.MSG_TRUNC:
            raise OSError("Missing or oversized forkserver status")
        message = json.loads(raw)
        if (not isinstance(message, dict) or message.get("generation") != self.ctx.generation
                or message.get("cellId") != self.cell.id):
            raise ValueError("Mismatched forkserver status identity")
        return message

    def _wait(self, handles, preparing):
        while True:
            cancelled = self._check_live()
            timeout = 0.1
            if preparing and not cancelled:
                remaining = self.deadline - time.monotonic()
                if remaining <= 0:
                    raise TimeoutError("Forkserver or isolated child preparation timed out")
                timeout = min(timeout, remaining)
            if ready := wait(handles, timeout):
                return ready

    def await_fork(self):
        self._wait([self.status], True)
        message = self._read_status()
        kind = message.get("kind")
        if kind == "cancelled" and message.keys() == {"kind", "generation", "cellId"}:
            raise KeyboardInterrupt()
        if kind == "rejected" and message.get("code") in ("ISOLATION_UNAVAILABLE", "BUSY"):
            reason = message.get("reason")
            if isinstance(reason, str):
                raise _IsolatedRejection(message["code"], reason)
        pid = message.get("pid")
        if (message.keys() != {"kind", "generation", "cellId", "pid", "pgid", "threads"}
                or kind != "forked" or type(pid) is not int or pid <= 0
                or type(message["pgid"]) is not int or message["pgid"] != pid
                or type(message["threads"]) is not int or message["threads"] != 1):
            raise ValueError("Invalid forkserver fork status")
        self.forked = True

    def _read_exit(self):
        message = self._read_status()
        code = message.get("exitCode")
        if (message.keys() != {"kind", "generation", "cellId", "exitCode", "cancelled"}
                or message["kind"] != "exited" or type(code) is not int or type(message["cancelled"]) is not bool):
            raise ValueError("Invalid forkserver exit status")
        self.exit_code = code
        self.cancelled = message["cancelled"]

    def await_exit(self, preparing=False):
        if self.exit_code is None:
            self._wait([self.status], preparing)
            self._read_exit()
        return self.exit_code

    def receive(self, max_length, preparing=False):
        """Read one bounded frame, or None after data is drained and the leader is reaped."""
        if self.data_done:
            self.await_exit(preparing)
            return None
        if self.exit_code is None:
            ready = self._wait([self.status, self.stream], preparing)
            if self.status in ready:
                self._read_exit()
        if self.exit_code is not None:
            self._wait([self.stream], preparing)
        try:
            return self.stream.recv_bytes(max_length)
        except EOFError:
            self.data_done = True
            self.await_exit(preparing)
            return None

    def drain_after_error(self):
        # Stop the child waiting for input, but retain the read half to prove EOF.
        peer = socket.socket(fileno=self.stream.fileno())
        try:
            peer.shutdown(socket.SHUT_WR)
        except OSError:
            pass
        finally:
            peer.detach()
        while not self.data_done:
            self._wait([self.stream], False)
            if not os.read(self.stream.fileno(), 65536):
                self.data_done = True
        self.await_exit()

    def commit(self):
        packet = json.dumps(dict(kind="commit", generation=self.ctx.generation, cellId=self.cell.id)).encode()
        self.status.settimeout(self.ctx.options["startTimeoutMs"] / 1000)
        if self.status.send(packet) != len(packet):
            raise OSError("Incomplete isolated commit request")
        message = self._read_status()
        if (message.keys() != {"kind", "generation", "cellId", "accepted"}
                or message["kind"] != "commit" or type(message["accepted"]) is not bool):
            raise ValueError("Invalid isolated commit status")
        return message["accepted"]

    def wait_for_retirement(self):
        # Without the owner's exit receipt we cannot release this execution slot.
        with self.ctx.condition:
            self.ctx.condition.wait_for(lambda: self.ctx.eof)
        raise KeyboardInterrupt()

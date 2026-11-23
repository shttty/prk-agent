import os
import signal
import socket


def fork_child(data):
    owner, child = socket.socketpair()
    pid = None
    try:
        # Only this service thread executes the gate and fork. Callers never fork.
        threads = None
        try:
            with open("/proc/self/status", encoding="ascii", errors="replace") as status:
                threads = next(int(line.split()[1]) for line in status if line.startswith("Threads:\t"))
        except (OSError, ValueError, IndexError, StopIteration):
            pass
        if threads != 1:
            return None, None, threads
        pid = os.fork()
        if pid == 0:
            try:
                signal.set_wakeup_fd(-1)
                signal.signal(signal.SIGTERM, signal.SIG_DFL)
                signal.signal(signal.SIGCHLD, signal.SIG_DFL)
                # Don't retain service control, status, or another cell's descriptors.
                keep = {0, 1, 2, child.fileno(), data.fileno()}
                for entry in os.listdir("/proc/self/fd"):
                    fd = int(entry)
                    if fd not in keep:
                        try:
                            os.close(fd)
                        except OSError:
                            pass  # /proc/self/fd includes the directory handle used by listdir.
                os.setsid()
                child.sendall(b"1")
                if child.recv(1) != b"1":
                    os._exit(1)
                child.close()
                os._exit(run_isolated_child(data))
            except BaseException:
                os._exit(1)
        return pid, owner, threads
    finally:
        child.close()
        if pid is None:
            owner.close()

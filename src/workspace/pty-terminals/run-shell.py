import ctypes
import os
import signal
import sys

# The daemon owns this PTY session leader; only the shell receives parent-death HUP.
nonce, *argv = sys.argv[1:]
parent = os.getpid()
ready_read, ready_write = os.pipe()
go_read, go_write = os.pipe()
child = os.fork()
if child == 0:
    os.close(ready_read)
    os.close(go_write)
    signal.signal(signal.SIGHUP, signal.SIG_DFL)
    if sys.platform == "linux":
        libc = ctypes.CDLL(None, use_errno=True)
        if libc.prctl(1, signal.SIGHUP, 0, 0, 0) != 0:
            raise OSError(ctypes.get_errno(), "PR_SET_PDEATHSIG failed")
        if os.getppid() != parent:
            os.kill(os.getpid(), signal.SIGHUP)
    os.setpgid(0, 0)
    os.write(ready_write, b"R")
    os.close(ready_write)
    if os.read(go_read, 1) != b"G":
        os._exit(1)
    os.close(go_read)
    os.execvp(argv[0], argv)
os.close(ready_write)
os.close(go_read)
if os.read(ready_read, 1) != b"R":
    os.waitpid(child, 0)
    raise RuntimeError("shell failed before PTY handoff")
os.close(ready_read)
signal.signal(signal.SIGTTOU, signal.SIG_IGN)
os.tcsetpgrp(0, child)
mode = "linux-pdeathsig" if sys.platform == "linux" else "normal-close-only"
os.write(1, ("\x1b]777;prk;" + nonce + ";" + str(parent) + ";" + str(child) + ";" + mode + "\x07").encode())
os.write(go_write, b"G")
os.close(go_write)
_, status = os.waitpid(child, 0)
code = os.waitstatus_to_exitcode(status)
sys.exit(code if code >= 0 else 128 - code)

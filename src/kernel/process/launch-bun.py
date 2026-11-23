import os
import sys


def launch_bun():
    executable, source, generation, scoped, maximum, chunk_bytes, runtime = sys.argv[1:]
    # os.dup makes a non-inheritable copy; only the four pipes survive exec.
    original_stderr = os.dup(2)
    try:
        control_in = os.dup(0)
        control_out = os.dup(1)
        devnull = os.open(os.devnull, os.O_RDONLY)
        os.dup2(devnull, 0)
        os.close(devnull)
        readers = []
        for fd in (1, 2):
            read_fd, write_fd = os.pipe()
            os.dup2(write_fd, fd)
            os.close(write_fd)
            readers.append(read_fd)
        fds = (control_in, control_out, *readers)
        for fd in fds:
            os.set_inheritable(fd, True)
        os.execv(executable, [executable, "--config=/dev/null", "--no-install", "--no-env-file", "-e", source, "--",
                             generation, str(os.getpgrp()), scoped, maximum, chunk_bytes, runtime, *map(str, fds)])
    except BaseException:
        os.dup2(original_stderr, 2)
        raise
    finally:
        os.close(original_stderr)


launch_bun()

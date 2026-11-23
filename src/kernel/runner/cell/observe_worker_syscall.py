import os
import struct
import sys
import time


# Native x86_64 syscall arguments and copied wait records never leave the runner.
_SYSCALL_NAMES = {**_SOCKET_DIRECT_WAITS, 7: "poll", 23: "select", 35: "nanosleep", 61: "wait4", 202: "futex",
                  230: "clock_nanosleep", 232: "epoll_wait", 247: "waitid", 270: "pselect6", 271: "ppoll",
                  281: "epoll_pwait", 441: "epoll_pwait2"}
_TIMEOUT_ARGUMENT = {23: 4, 35: 0, 230: 2, 270: 4, 271: 2}


def _read_syscall(tid):
    with open(f"/proc/self/task/{tid}/syscall", "rb", buffering=0) as source:
        line = source.read(257)
    if len(line) > 256 or not line.endswith(b"\n"):
        return None
    if line == b"running\n":
        return ()
    words = line.split()
    if len(words) != 9:
        return None
    try:
        number = int(words[0], 10)
        arguments = tuple(int(word, 16) for word in words[1:])
    except ValueError:
        return None
    if not 0 <= number < 2 ** 30 or any(not 0 <= arg < 2 ** 64 for arg in arguments):
        return None
    return number, arguments


def _owns_cancelled_worker(ctx, cell, thread, tid, token=None):
    if (tid is None or thread.native_id != tid or ctx.cells.get(cell.id) is not cell
            or not cell.cancelled):
        return False
    if token is None:
        return cell.user_thread is thread and cell.worker is thread
    segment = _current_shared_segment(ctx)
    return (segment is not None and segment.token is token and segment.cell is cell
            and segment.thread is thread and not segment.protected)


def _read_worker_parameters(address, size):
    if not 0 < address <= (1 << 63) - size:
        return None
    fd = os.open("/proc/self/mem", os.O_RDONLY | os.O_CLOEXEC)
    try:
        block = os.pread(fd, size, address)
        return block if len(block) == size else None
    finally:
        os.close(fd)


def observe_worker_syscall(ctx, cell, thread, token=None):
    """Called once under the registration gate with the original execution identity."""
    if sys.platform != "linux" or os.uname().machine != "x86_64" or struct.calcsize("P") != 8:
        return [_stop_step("syscall", "unavailable", "Native Linux x86_64 syscall observation is unavailable")]
    tid = thread.native_id
    if not _owns_cancelled_worker(ctx, cell, thread, tid, token):
        return [_stop_step("syscall", "skipped", "Cancelled worker registration is no longer current")]
    steps = []
    try:
        sample = _read_syscall(tid)
        if sample == ():
            return [_stop_step("syscall", "running", "Worker was running at the sample")]
        if sample is None:
            return [_stop_step("syscall", "unknown", "No complete native syscall sample")]
        number, arguments = sample
        name = _SYSCALL_NAMES.get(number, f"syscall #{number}")
        steps.append(_stop_step("syscall", "observed", name))
        if number in (61, 247):
            return steps + [stop_child_wait(ctx, cell, thread, tid, sample, name, token)]
        if number in _SOCKET_DIRECT_WAITS or (
            number in _SOCKET_SET_WAITS and arguments[0 if number in (23, 270) else 1] != 0
        ):
            if number in _PIPE_CHILD_WAITS:
                child = stop_pipe_child_wait(ctx, cell, thread, tid, sample, name, token)
                if child is not None:
                    return steps + [child]
            return steps + [stop_socket_wait(ctx, cell, thread, tid, sample, name, token)]
        index = _TIMEOUT_ARGUMENT.get(number)
        address = arguments[index] if index is not None else 0
        if number != 7 and not address:
            return steps
        sampled_at_ns = time.monotonic_ns() if number == 230 else 0
        if address > (1 << 63) - 16 or _read_syscall(tid) != sample:
            return steps + [_stop_step("parameters", "unknown", "Address out of range or syscall sample changed")]
        block = None
        if address:
            block = _read_worker_parameters(address, 16)
            stable = block is not None and _read_syscall(tid) == sample
            steps.append(_stop_step("parameters", "observed" if stable else "unknown",
                                    "Complete fixed-size parameter block" if stable else "Short read or syscall sample changed"))
            if not stable:
                return steps
        timer = decode_timer_wait(number, arguments, block, name, sampled_at_ns)
        if timer is not None:
            if token is not None and (_read_syscall(tid) != sample
                                      or not _owns_cancelled_worker(ctx, cell, thread, tid, token)):
                return steps + [_stop_step("timer", "skipped", "Cancelled execution or timer wait changed")]
            steps.append(timer)
    except OSError as error:
        step = "parameters" if steps else "syscall"
        extra = {"errno": error.errno} if error.errno and error.errno > 0 else {}
        steps.append(_stop_step(step, "unavailable", "Self observation failed", **extra))
    return steps

import os
import select
import stat
import struct
from contextlib import ExitStack


_PIPE_CHILD_WAITS = (0, 19, 7, 271)  # read, readv, poll, ppoll
_PIPE_READ_EVENTS = select.POLLIN | getattr(select, "POLLRDNORM", 0x40)
_PIPE_FD_SCAN_LIMIT = 8192


def _pipe_wait_set(number, args):
    if number in (0, 19):
        return ((args[0], _PIPE_READ_EVENTS),), None
    if not 0 < args[1] <= _MAX_WAIT_FDS:
        return (), None
    block = _read_worker_parameters(args[0], args[1] * 8)
    if block is None:
        return (), None
    return tuple((fd, events) for fd, events, _ in struct.iter_unpack("<ihh", block) if fd >= 0), block


def _pipe_id(info):
    return info.st_dev, info.st_ino


def _pipe_link(identity):
    return f"pipe:[{identity[1]}]"


def _verified_read_pipe(task, fd, identity, direct):
    path = f"{task}/fd/{fd}"
    if os.readlink(path) != _pipe_link(identity):
        raise _ChildWaitRejected("Descriptor is not an anonymous read pipe")
    flags = _child_proc_field(f"{task}/fdinfo/{fd}", b"flags", 8)
    mask = os.O_ACCMODE | os.O_PATH | (os.O_NONBLOCK if direct else 0)
    if flags & mask != os.O_RDONLY:
        raise _ChildWaitRejected("Descriptor is not a readable pipe for this wait")
    info = os.stat(path)
    if not stat.S_ISFIFO(info.st_mode) or _pipe_id(info) != identity:
        raise _ChildWaitRejected("Wait descriptor changed during pipe observation")


def _pipe_writers(identities):
    tasks, children = _direct_child_snapshot()
    parent = os.getpid()
    pipe_links = {_pipe_link(identity) for identity in identities}
    writers = set()
    remaining = _PIPE_FD_SCAN_LIMIT
    # Inspect just this runner and its direct children. On Linux a task can
    # unshare its fd table, so the process leader's table alone is not enough.
    for pid in (parent, *sorted(children)):
        root = "/proc/self/task" if pid == parent else f"/proc/{pid}/task"
        tids = tasks if pid == parent else _child_proc_ids(root)
        if not tids:
            raise _ChildWaitRejected("Incomplete task snapshot while looking for pipe writers")
        if pid != parent:
            _verify_direct_parent(pid, parent)
        for tid in tids:
            task = f"{root}/{tid}"
            with os.scandir(f"{task}/fd") as entries:
                for entry in entries:
                    if remaining == 0:
                        raise _ChildWaitRejected("Pipe writer snapshot exceeds the descriptor bound")
                    remaining -= 1
                    if os.readlink(entry.path) not in pipe_links:
                        continue
                    info = os.stat(entry.path)
                    identity = _pipe_id(info)
                    if not stat.S_ISFIFO(info.st_mode) or identity not in identities:
                        raise _ChildWaitRejected("Pipe writer descriptor changed during observation")
                    flags = _child_proc_field(f"{task}/fdinfo/{entry.name}", b"flags", 8)
                    if _pipe_id(os.stat(entry.path)) != identity:
                        raise _ChildWaitRejected("Pipe writer descriptor changed during observation")
                    if not flags & os.O_PATH and flags & os.O_ACCMODE in (os.O_WRONLY, os.O_RDWR):
                        writers.add((pid, tid, entry.name, identity))
        if tids != _child_proc_ids(root):
            raise _ChildWaitRejected("Task set changed while looking for pipe writers")
        if pid != parent:
            _verify_direct_parent(pid, parent)
    if _direct_child_snapshot() != (tasks, children):
        raise _ChildWaitRejected("Direct child set changed while looking for pipe writers")
    return children, writers


def _pipe_blocking_parameters(number, args):
    if number == 0 and not args[2]:
        raise _ChildWaitRejected("Empty pipe read is not a blocking wait")
    if number == 19:
        count = args[2]
        block = _read_worker_parameters(args[1], count * 16) if 0 < count <= _MAX_WAIT_FDS else None
        if block is None or not any(size for _, size in struct.iter_unpack("<QQ", block)):
            raise _ChildWaitRejected("Cannot verify a nonempty pipe readv")
        return block
    if number == 7 and not (args[2] & 0xffffffff):
        raise _ChildWaitRejected("Zero-timeout poll is not a blocking wait")
    if number == 271 and args[2]:
        block = _read_worker_parameters(args[2], 16)
        if block is None:
            raise _ChildWaitRejected("Incomplete ppoll timeout")
        seconds, nanos = struct.unpack("<qq", block)
        if not (seconds >= 0 and 0 <= nanos < 1_000_000_000 and (seconds or nanos)):
            raise _ChildWaitRejected("ppoll timeout does not allow blocking")
        return block
    return None


def stop_pipe_child_wait(ctx, cell, thread, tid, sample, name, token=None):
    """Return None for the original socket path unless a pipe is identified."""
    number, args = sample
    direct = number in (0, 19)
    task = f"/proc/self/task/{tid}"
    pipes = {}
    missing = False
    try:
        selection = _pipe_wait_set(number, args)
        for fd, _ in selection[0]:
            try:
                info = os.stat(f"{task}/fd/{fd}")
            except OSError:
                missing = True
                continue
            if stat.S_ISFIFO(info.st_mode):
                pipes[fd] = _pipe_id(info)
            else:
                missing = True
        if not pipes:
            return None
        if missing or any(not events or events & ~_PIPE_READ_EVENTS for _, events in selection[0]):
            raise _ChildWaitRejected("Wait set contains mixed or non-readable descriptors")
        blocking = _pipe_blocking_parameters(number, args)
        identities = set(pipes.values())
        if len(identities) > 2:
            raise _ChildWaitRejected("Wait set contains more than two pipes")
        with ExitStack() as stack:
            for fd, identity in pipes.items():
                _verified_read_pipe(task, fd, identity, direct)
                duplicate = os.dup(fd)
                stack.callback(os.close, duplicate)
                _verified_read_pipe("/proc/self", duplicate, identity, direct)
            first = _pipe_writers(identities)
            writers = first[1]
            pids = {pid for pid, _, _, _ in writers}
            written = {identity for _, _, _, identity in writers}
            if pids == {os.getpid()} and written == identities:
                return None  # Ordinary local IPC retains its original socket diagnostic.
            if os.getpid() in pids:
                raise _ChildWaitRejected("The runner also holds a pipe writer")
            if len(pids) != 1 or written != identities:
                raise _ChildWaitRejected("Each waited pipe must have a writer in the same unique direct child")
            pid, = pids

            def verify_owner():
                if _pipe_writers(identities) != first:
                    raise _ChildWaitRejected("Pipe writer evidence changed before signal")

            def verify_wait():
                if _pipe_wait_set(number, args) != selection or _pipe_blocking_parameters(number, args) != blocking:
                    raise _ChildWaitRejected("Worker pipe wait parameters changed before signal")
                for fd, identity in pipes.items():
                    _verified_read_pipe(task, fd, identity, direct)

            return _signal_waited_child(ctx, cell, thread, tid, sample, name, pid,
                                        verify_owner, verify_wait, token=token)
    except (_ChildWaitRejected, OSError) as error:
        return _child_wait_refusal(name, error) if pipes else None

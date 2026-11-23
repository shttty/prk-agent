import errno
import os
import select
import signal
import time


class _ChildWaitRejected(Exception):
    pass


_PIDFD_SIGNAL_PROCESS_GROUP = 1 << 2
_CHILD_SNAPSHOT_LIMIT = 4096


def _child_proc_field(path, field, base=10):
    with open(path, "rb") as source:
        data = source.read(4096)
    for line in data.splitlines(keepends=True):
        if line.startswith(field + b":") and line.endswith(b"\n"):
            try:
                return int(line.split(b":", 1)[1], base)
            except ValueError:
                break
    raise _ChildWaitRejected("Incomplete /proc child or descriptor metadata")


def _child_proc_ids(path):
    with os.scandir(path) as entries:
        ids = set()
        for entry in entries:
            if len(ids) == _CHILD_SNAPSHOT_LIMIT or not entry.name.isdecimal():
                raise _ChildWaitRejected("Incomplete /proc task snapshot")
            ids.add(int(entry.name))
        return ids


def _direct_child_snapshot():
    tasks = _child_proc_ids("/proc/self/task")
    children = set()
    for tid in tasks:
        with open(f"/proc/self/task/{tid}/children", "rb") as source:
            data = source.read(32769)
        if len(data) > 32768 or (data and not data[-1:].isspace()):
            raise _ChildWaitRejected("Incomplete /proc direct child list")
        for word in data.split():
            if len(children) == _CHILD_SNAPSHOT_LIMIT or not word.isdigit() or int(word) == 0:
                raise _ChildWaitRejected("Incomplete /proc direct child list")
            children.add(int(word))
    if not tasks or tasks != _child_proc_ids("/proc/self/task"):
        raise _ChildWaitRejected("Runner task set changed during child observation")
    return tasks, children


def _verify_direct_parent(pid, parent):
    if _child_proc_field(f"/proc/{pid}/status", b"PPid") != parent:
        raise _ChildWaitRejected("Target is not a direct child of the runner")


def _linux_pidfd_syscall():
    # These syscall numbers are only used inside the native Linux x86_64 gate.
    try:
        from ctypes import CDLL, c_long, get_errno
        syscall = CDLL(None, use_errno=True).syscall
    except (ImportError, AttributeError, OSError) as error:
        raise _ChildWaitRejected("Native pidfd operations are unavailable") from error
    syscall.restype = c_long

    def invoke(number, *args):
        result = syscall(c_long(number), *args)
        if result < 0:
            code = get_errno()
            raise OSError(code, os.strerror(code))
        return result

    return invoke


def _open_child_pidfd(pid):
    if hasattr(os, "pidfd_open"):
        return os.pidfd_open(pid, 0)
    return _linux_pidfd_syscall()(434, pid, 0)


def _child_signal_sender(flags):
    if hasattr(signal, "pidfd_send_signal"):
        return lambda fd: signal.pidfd_send_signal(fd, signal.SIGKILL, None, flags)
    syscall = _linux_pidfd_syscall()
    return lambda fd: syscall(424, fd, signal.SIGKILL, None, flags)


def _signal_waited_child(ctx, cell, thread, tid, sample, name, pid,
                         verify_owner, verify_wait, waited_fd=None, token=None):
    parent = os.getpid()
    _verify_direct_parent(pid, parent)
    groups = (os.getpgid(pid), os.getpgrp())
    group = groups[0] == pid and groups[1] != pid
    flags = _PIDFD_SIGNAL_PROCESS_GROUP if group else 0
    send = _child_signal_sender(flags)
    fd = _open_child_pidfd(pid) if waited_fd is None else os.dup(waited_fd)
    try:
        fdinfo = f"/proc/self/fdinfo/{fd}"
        poller = select.poll()
        poller.register(fd, select.POLLIN)
        if _child_proc_field(fdinfo, b"Pid") != pid:
            raise _ChildWaitRejected("Pinned pidfd does not refer to the waited child")
        verify_owner()
        _verify_direct_parent(pid, parent)
        if (os.getpgid(pid), os.getpgrp()) != groups:
            raise _ChildWaitRejected("Child or runner process group changed")
        verify_wait()
        if _child_proc_field(fdinfo, b"Pid") != pid or poller.poll(0):
            raise _ChildWaitRejected("Pinned pidfd is detached or child is no longer live")
        if _read_syscall(tid) != sample or not _owns_cancelled_worker(ctx, cell, thread, tid, token):
            raise _ChildWaitRejected("Cancelled worker or native syscall sample changed before signal")
        try:
            send(fd)
        except OSError as error:
            if group and error.errno in (errno.EINVAL, errno.ENOSYS, errno.EOPNOTSUPP):
                raise _ChildWaitRejected("PIDFD_SIGNAL_PROCESS_GROUP is unavailable") from error
            raise
        cell.waited_child_pidfd = fd
        fd = None  # Settlement owns confirmation and closure after user execution.
        action = "SIGKILL via pidfd to process group" if group else "SIGKILL via pidfd to child PID"
        return _stop_step("child", "applied", f"{name}: direct child {pid}; reap is unconfirmed", action=action)
    finally:
        if fd is not None:
            os.close(fd)


def _child_wait_refusal(name, error):
    if isinstance(error, _ChildWaitRejected):
        return _stop_step("child", "skipped", f"{name}: {error}")
    extra = {"errno": error.errno} if error.errno and error.errno > 0 else {}
    return _stop_step("child", "unavailable", f"{name}: child wait observation or pidfd signal failed", **extra)


def stop_child_wait(ctx, cell, thread, tid, sample, name, token=None):
    number, args = sample
    # Linux reads these arguments as C ints, regardless of unused register high bits.
    first, second, third, fourth = (arg & 0xffffffff for arg in args[:4])
    waited_fd = None
    try:
        if number == 61 and third == 0:  # wait4(pid, status, options, rusage)
            pid = first
        elif number == 247 and fourth == 4 and first in (1, 3):  # waitid(P_PID/P_PIDFD, ..., WEXITED)
            if first == 3 and second < 1 << 31:
                waited_fd = second
                wait_info = f"/proc/self/task/{tid}/fdinfo/{waited_fd}"
                pid = _child_proc_field(wait_info, b"Pid")
            else:
                pid = second
        else:
            raise _ChildWaitRejected("Wait does not request one child's blocking exit and reap")
        if not 0 < pid < 1 << 31:
            raise _ChildWaitRejected("Wait does not identify a positive child PID")
        tasks, children = _direct_child_snapshot()
        if tid not in tasks or pid not in children:
            raise _ChildWaitRejected("Wait target is not in the runner's direct child set")

        def verify_owner():
            current_tasks, current_children = _direct_child_snapshot()
            if tid not in current_tasks or pid not in current_children:
                raise _ChildWaitRejected("Wait target left the runner's direct child set")

        def verify_wait():
            if waited_fd is not None and (_child_proc_field(wait_info, b"flags", 8) & os.O_NONBLOCK
                                          or _child_proc_field(wait_info, b"Pid") != pid):
                raise _ChildWaitRejected("Wait pidfd changed or is nonblocking")

        return _signal_waited_child(ctx, cell, thread, tid, sample, name, pid,
                                    verify_owner, verify_wait, waited_fd, token)
    except (_ChildWaitRejected, OSError) as error:
        return _child_wait_refusal(name, error)


def _waited_child_reap_confirmed(fd, poller, timeout_ms):
    # POLLIN means exit (including a zombie); never consume the original wait status.
    if any(events & select.POLLHUP for _, events in poller.poll(timeout_ms)):
        return True
    return _child_proc_field(f"/proc/self/fdinfo/{fd}", b"Pid") == -1


def poll_waited_child_reap(cell):
    fd = cell.waited_child_pidfd
    if fd is None:
        return True
    poller = select.poll()
    poller.register(fd, 0)
    try:
        if not _waited_child_reap_confirmed(fd, poller, 0):
            return False
    except (_ChildWaitRejected, OSError):
        return False
    os.close(fd)
    cell.waited_child_pidfd = None
    return True


def await_waited_child_reap(cell):
    fd = cell.waited_child_pidfd
    if fd is None:
        return
    try:
        poller = select.poll()
        poller.register(fd, 0)
        while True:
            try:
                if _waited_child_reap_confirmed(fd, poller, 50):
                    return
            except (_ChildWaitRejected, OSError):
                time.sleep(0.05)  # No evidence of reap; keep this slot occupied.
    finally:
        os.close(fd)
        cell.waited_child_pidfd = None

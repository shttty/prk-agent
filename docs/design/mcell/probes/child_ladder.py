"""Throwaway Linux x86_64 probe. Run normally (assertions enabled), not as runner code."""
import ctypes as C
from contextlib import ExitStack, contextmanager
import json
import os
from pathlib import Path
import platform
import select
import signal
import stat
import struct
import subprocess as sp
import sys
import threading as th
import time

PROC = Path('/proc/self')
FIXTURE = Path(__file__).with_name('child_fixture.py')
WAIT4, POLL = 61, 7
libc = C.CDLL(None, use_errno=True)
libc.syscall.restype = C.c_long
inject = C.pythonapi.PyThreadState_SetAsyncExc
inject.argtypes = [C.c_ulong, C.py_object]
inject.restype = C.c_int


class StopCell(BaseException):
    pass


def native(number, *args):
    result = libc.syscall(C.c_long(number), *args)
    if result == -1:
        error = C.get_errno()
        raise OSError(error, os.strerror(error))
    return result


def pidfd_open(pid):
    return os.pidfd_open(pid, 0) if hasattr(os, 'pidfd_open') else native(434, C.c_int(pid), C.c_uint(0))


def signal_child(fd):
    if hasattr(signal, 'pidfd_send_signal'):
        signal.pidfd_send_signal(fd, signal.SIGKILL, None, 0)
    else:
        native(424, C.c_int(fd), C.c_int(signal.SIGKILL), C.c_void_p(), C.c_uint(0))


def fields(path):
    return dict(line.split(':', 1) for line in path.read_text().splitlines())


def attached_pid(fd):
    return int(fields(PROC / 'fdinfo' / str(fd))['Pid'])


def children(tid):
    return tuple(map(int, (PROC / 'task' / str(tid) / 'children').read_text().split()))


def sample(tid):
    raw = (PROC / 'task' / str(tid) / 'syscall').read_text().split()
    if len(raw) != 9 or raw[0] == '-1':
        return ()
    return tuple(int(word, 0) for word in raw[:7])


def eventually(check, seconds=3):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        result = check()
        if result:
            return result
        time.sleep(0.001)
    raise AssertionError(f'timed out: {check!r}')


def observe(worker, number):
    def check():
        snap = sample(worker.native_id)
        return snap if snap and snap[0] == number else ()
    return eventually(check)


def is_ready(fd, timeout=0):
    poll = select.poll()
    poll.register(fd, select.POLLIN)
    return poll.poll(timeout)


def wait_target(snap):
    if snap and snap[0] == WAIT4 and C.c_int32(snap[3]).value == 0:
        pid = C.c_int32(snap[1]).value  # pid_t is signed, even in a 64-bit syscall register.
        if pid > 0:
            return pid
    return None


def revalidate(worker, snap, pid, fd):
    try:
        return (pid in children(worker.native_id)
                and sample(worker.native_id)[:5] == snap[:5]
                and attached_pid(fd) == pid and not is_ready(fd))
    except (OSError, KeyError, ValueError):
        return False


def verify_reaped(pid):
    try:
        status = os.waitpid(pid, os.WNOHANG)
    except ChildProcessError:  # Only this fixture and standard Popen can reap; SIGCHLD is default.
        return
    raise AssertionError(f'{pid=} not previously reaped: {status=}')


class Gate:
    def __init__(self, stack):
        self.r, self.w = os.pipe()
        stack.callback(os.close, self.r)
        stack.callback(self.release)

    def release(self):
        if self.w is not None:
            os.close(self.w)
            self.w = None


class Child:
    def __init__(self, stack, close_stdout=False):
        self.life = Gate(stack)
        self.ready = Gate(stack)
        self.drop = Gate(stack) if close_stdout else None
        drop_fd = self.drop.r if self.drop else -1
        self.args = [sys.executable, '-I', str(FIXTURE), str(self.life.r), str(self.ready.w), str(drop_fd)]
        self.fds = (self.life.r, self.ready.w) + ((drop_fd,) if self.drop else ())

    def start(self, **kwargs):
        return sp.Popen(self.args, pass_fds=self.fds, **kwargs)

    def run(self, **kwargs):
        return sp.run(self.args, pass_fds=self.fds, **kwargs)

    def fixture_pid(self):
        assert is_ready(self.ready.r, 3000)
        return int(os.read(self.ready.r, 64))


class Worker(th.Thread):
    def __init__(self, call):
        self.error = None
        self.result = None
        self.finished = None
        super().__init__(target=call, name='child-cell')
        self.start()

    def run(self):
        try:
            self.result = self._target()
        except BaseException as error:
            self.error = error
        finally:
            self.finished = time.monotonic()

    def done(self, interrupted=False):
        self.join(10)
        assert not self.is_alive()
        if interrupted:
            assert type(self.error) is StopCell, self.error
        elif self.error is not None:
            raise self.error
        return self.result


def emit(case, **kwargs):
    print(json.dumps(dict(case=case, **kwargs)), flush=True)


def ms(start, end=None):
    return round(((time.monotonic() if end is None else end) - start) * 1000, 3)


def direct_wait(mode, sibling, sibling_fd):
    with ExitStack() as stack:
        fixture = Child(stack)
        returned_calls = []
        if mode == 'run':
            call = fixture.run  # No intercepted Popen; PID is independently reported by the fixture.
        else:
            def call():
                with fixture.start(start_new_session=(mode == 'wait-new-session')) as process:
                    try:
                        return process.wait()
                    finally:
                        returned_calls.append(process.returncode)
        worker = Worker(call)
        pid = fixture.fixture_pid()
        snap = observe(worker, WAIT4)
        assert wait_target(snap) == pid
        owned_before = children(worker.native_id)
        main_children = children(th.get_native_id())
        assert pid in owned_before and pid not in main_children
        assert sibling.pid in main_children and sibling.pid not in owned_before
        group = os.getpgid(pid)
        assert os.getpgid(sibling.pid) == os.getpgrp()
        assert group == (pid if mode == 'wait-new-session' else os.getpgrp())
        fd = pidfd_open(pid)
        stack.callback(os.close, fd)
        if mode == 'stale-recheck':
            fixture.life.release()
            assert worker.done() == 0
            verify_reaped(pid)
            assert not revalidate(worker, snap, pid, fd) and attached_pid(fd) == -1
            emit(mode, tid=worker.native_id, pid=pid, initial_children=owned_before,
                 pidfd_pid_after_reap=attached_pid(fd), pidfd_poll_after_reap=is_ready(fd),
                 signal_sent=False, reaped=True)
            return
        assert inject(worker.ident, StopCell) == 1
        start = time.monotonic()
        time.sleep(0.03)
        assert worker.is_alive() and revalidate(worker, snap, pid, fd)
        async_only_ms = ms(start)
        start = time.monotonic()
        signal_child(fd)  # Only call site: exact fixture PID and live per-thread child + repeated wait proved.
        sent = time.monotonic()
        worker.done(interrupted=True)
        verify_reaped(pid)
        assert attached_pid(fd) == -1 and is_ready(fd) and not is_ready(sibling_fd)
        emit(mode, tid=worker.native_id, syscall=snap, pid=pid, pgid=group, sibling=sibling.pid,
             parent_pgid=os.getpgrp(), target_children=owned_before, main_children=main_children,
             async_only_ms=async_only_ms, pidfd_signal_ms=ms(start, sent),
             signal_to_worker_done_ms=ms(start, worker.finished),
             pidfd_after_reap=attached_pid(fd), original_wait_returncode_before_context_exit=returned_calls,
             reaped=True, sibling_alive=True)


def decline_other_wait(sibling, sibling_fixture):
    with ExitStack() as stack:
        fixture = Child(stack)
        own = fixture.start()
        assert own.pid == fixture.fixture_pid()
        worker = Worker(lambda: os.waitpid(0, 0))
        group_wait = observe(worker, WAIT4)
        assert C.c_int32(group_wait[1]).value == 0 and wait_target(group_wait) is None
        assert own.pid != sibling.pid
        fixture.life.release()
        assert worker.done() == (own.pid, 0)
        verify_reaped(own.pid)
        worker = Worker(sibling.wait)
        snap = observe(worker, WAIT4)
        assert wait_target(snap) == sibling.pid and sibling.pid not in children(worker.native_id)
        sibling_fixture.life.release()
        assert worker.done() == 0
        verify_reaped(sibling.pid)
        emit('decline', group_wait=group_wait, group_reaped=own.pid,
             wrong_thread_wait=snap, wrong_thread_pid=sibling.pid, signal_sent=False, reaped=True)


def pipe_writer(pid):
    root = Path(f'/proc/{pid}')
    fd = root / 'fd/1'
    info = root / 'fdinfo/1'
    try:
        data = fd.stat()
        assert stat.S_ISFIFO(data.st_mode) and int(fields(info)['flags'], 8) & os.O_ACCMODE == os.O_WRONLY
        return (data.st_dev, data.st_ino)
    except FileNotFoundError:
        return None


def pipe_case():
    with ExitStack() as stack:
        first, second = Child(stack, close_stdout=True), Child(stack)
        pair = []
        published = th.Event()

        def call():
            with first.start(stdout=sp.PIPE, stderr=sp.PIPE) as proc:
                with open(f'/proc/{proc.pid}/fd/1', 'wb', buffering=0) as writer:
                    helper = second.start(stdout=writer)
                try:
                    pair.extend((proc, helper))
                    published.set()
                    return proc.communicate()
                finally:
                    helper.wait()

        worker = Worker(call)
        assert published.wait(3)
        primary, helper = pair
        assert primary.pid == first.fixture_pid() and helper.pid == second.fixture_pid()
        primary_fd = pidfd_open(primary.pid)
        stack.callback(os.close, primary_fd)
        read_fd = os.dup(primary.stdout.fileno())
        stack.callback(os.close, read_fd)
        identity = os.fstat(read_fd)
        inode = (identity.st_dev, identity.st_ino)
        assert stat.S_ISFIFO(identity.st_mode)
        snap = observe(worker, POLL)
        with open('/proc/self/mem', 'rb', buffering=0) as mem:
            assert snap[2] == 2  # pollfd[2] known for this two-output-pipe fixture.
            fds = [struct.unpack('=ihh', os.pread(mem.fileno(), 8, snap[1] + 8*i))[:2]
                   for i in range(snap[2])]
        assert (primary.stdout.fileno(), select.POLLIN) in fds
        assert (primary.stderr.fileno(), select.POLLIN) in fds
        assert sample(worker.native_id)[:4] == snap[:4]
        owned = children(worker.native_id)
        assert set(owned) == {primary.pid, helper.pid}
        assert inode == pipe_writer(primary.pid) == pipe_writer(helper.pid)
        assert not is_ready(read_fd)
        start = time.monotonic()
        second.life.release()  # First writer exits and is reaped; another writer keeps poll blocked.
        assert helper.wait(3) == 0
        verify_reaped(helper.pid)
        first_exit_ms = ms(start)
        assert sample(worker.native_id)[:4] == snap[:4] and not is_ready(read_fd)
        with open(f'/proc/{primary.pid}/fd/1', 'wb', buffering=0) as unknown:
            first.drop.release()  # Child closes output but stays alive on a different fixture gate.
            start = time.monotonic()
            eventually(lambda: pipe_writer(primary.pid) is None)
            writer_closed_ms = ms(start)
            assert not is_ready(primary_fd) and not is_ready(read_fd)
            assert sample(worker.native_id)[:4] == snap[:4]
            start = time.monotonic()
        hup = is_ready(read_fd, 3000)
        hup_ms = ms(start)
        assert hup == [(read_fd, select.POLLHUP)] and os.read(read_fd, 1) == b''
        # stderr is still open. After removing stdout from the selector it still polls stderr.
        after_hup = eventually(lambda: (s if (s := sample(worker.native_id))
                                        and s[0] == POLL and s[2] == 1 else ()))
        assert not is_ready(primary_fd)
        start = time.monotonic()
        first.life.release()
        assert worker.done() == (b'', b'') and primary.returncode == 0
        verify_reaped(primary.pid)
        assert attached_pid(primary_fd) == -1
        emit('communicate-shared-pipe', syscall=snap, poll_fds=fds, pipe_dev_inode=inode,
             owned_writer_pids=owned, first_writer_exit_and_reap_ms=first_exit_ms,
             kept_polling_after_first_writer_exit=True, no_child_writer_close_ms=writer_closed_ms,
             kept_polling_with_only_parent_writer=True, hup=hup, last_writer_close_to_hup_ms=hup_ms,
             primary_alive_at_hup=True, after_hup_syscall=after_hup,
             primary_exit_to_worker_done_ms=ms(start, worker.finished), signal_sent=False,
             reaped=[helper.pid, primary.pid])


def reparent_case():
    with ExitStack() as stack:
        fixture = Child(stack)
        leave = th.Event()
        created = []

        def call():
            created.append(fixture.start())
            assert leave.wait(3)

        worker = Worker(call)
        pid = fixture.fixture_pid()
        process = eventually(lambda: created)[0]
        assert pid == process.pid
        before = children(worker.native_id)
        assert pid in before and pid not in children(th.get_native_id())
        leave.set()
        worker.done()
        after = children(th.get_native_id())
        assert pid in after
        fixture.life.release()
        assert process.wait(3) == 0
        verify_reaped(pid)
        emit('reparent-after-thread-exit', creator_tid=worker.native_id, creator_children=before,
             adopter_tid=th.get_native_id(), adopter_children=after, pid=pid, signal_sent=False, reaped=True)


if __name__ == '__main__':
    assert __debug__ and sys.platform == 'linux' and platform.machine() == 'x86_64'
    assert signal.getsignal(signal.SIGCHLD) == signal.SIG_DFL
    assert not children(th.get_native_id())
    cgroup = (PROC / 'cgroup').read_text().strip().removeprefix('0::')
    budget = Path('/sys/fs/cgroup' + cgroup + '/memory.max')
    emit('env', version=platform.python_version(), kernel=platform.release(),
         parent=os.getpid(), affinity=sorted(os.sched_getaffinity(0)),
         memory_max=budget.read_text().strip() if budget.exists() else None,
         pidfd_backend='stdlib' if hasattr(os, 'pidfd_open') else 'syscall')
    with ExitStack() as stack:
        sibling_fixture = Child(stack)
        sibling = sibling_fixture.start()
        assert sibling.pid == sibling_fixture.fixture_pid()
        sibling_fd = pidfd_open(sibling.pid)
        stack.callback(os.close, sibling_fd)
        for mode in ('wait-default-group', 'run', 'wait-new-session', 'stale-recheck'):
            direct_wait(mode, sibling, sibling_fd)
        assert not is_ready(sibling_fd)
        decline_other_wait(sibling, sibling_fixture)
        assert attached_pid(sibling_fd) == -1 and is_ready(sibling_fd)
    pipe_case()
    reparent_case()
    assert th.active_count() == 1 and not children(th.get_native_id())
    emit('cleanup', children=children(th.get_native_id()), threads=th.active_count())

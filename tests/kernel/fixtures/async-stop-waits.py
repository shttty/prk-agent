import asyncio
import os
from pathlib import Path
import select
import socket
import subprocess
import sys
import threading
import time
from contextlib import contextmanager


@contextmanager
def observe_wait(name, syscalls, argument, release=None):
    """Witness the test's own native wait; release indefinite waits on failure."""
    tid = threading.get_native_id()
    sample = Path(f"/proc/self/task/{tid}/syscall")
    root = Path.cwd()
    ready, check, intact, resume = (root / f"{name}.{suffix}" for suffix in ("ready", "check", "intact", "release"))
    done = threading.Event()
    deadline = time.monotonic() + 25

    def observe():
        entered = False
        while not done.wait(0.01):
            if (root / "release-all").exists() or resume.exists() or time.monotonic() >= deadline:
                if release is not None:
                    try:
                        release()
                    except OSError:
                        if not done.is_set():
                            raise
                return
            try:
                fields = sample.read_text().split()
            except FileNotFoundError:
                return
            if len(fields) < 2 or fields[0] not in syscalls or int(fields[1], 16) != argument:
                continue
            if not entered:
                ready.touch()
                entered = True
            if check.exists() and not intact.exists():
                intact.touch()

    watcher = threading.Thread(target=observe, daemon=True)
    watcher.start()
    try:
        yield
    finally:
        done.set()


class AsyncStopTrial:
    def __init__(self, loop):
        self.loop = loop
        self.a_ready = loop.create_future()
        self.c_ready = loop.create_future()

    def current(self):
        assert asyncio.get_running_loop() is self.loop
        task = asyncio.current_task()
        assert isinstance(task, asyncio.Task)
        return task

    async def run_a(self, cleanup_gate=None, callback=None):
        self.a = self.current()
        if callback is not None:
            self.loop.call_soon(callback)
        print("A_WAITING")
        try:
            await self.a_ready
            raise AssertionError("A resumed without cancellation")
        except asyncio.CancelledError:
            assert self.current() is self.a
            print("A_CANCELLED")
            raise
        finally:
            assert self.current() is self.a
            print("A_FINALLY_ENTER")
            if cleanup_gate is not None:
                while not Path(cleanup_gate).exists() and not Path("release-all").exists():
                    await asyncio.sleep(0.01)
            assert self.current() is self.a
            print("A_FINALLY_EXIT")

    async def run_c(self):
        self.c = self.current()
        assert self.c is not self.a
        print("C_WAITING")
        await self.c_ready
        assert self.current() is self.c and self.c is not self.b
        print("C_RESUMED")
        await asyncio.wait([self.b])
        assert self.b.done() and self.current() is self.c
        print("C_OK_AFTER_B_TASK_DONE")

    def run_b(self):
        self.b = self.current()
        assert self.b is not self.a and self.b is not self.c
        self.c_ready.set_result(None)  # C is runnable but cannot resume during the synchronous wait.
        try:
            self.socket_wait("b")
            raise AssertionError("B left recv without cancellation")
        finally:
            assert self.current() is self.b
            print("B_FINALLY")

    @staticmethod
    def socket_wait(name):
        endpoint, peer = socket.socketpair()
        with endpoint, peer, observe_wait(name, ("45",), endpoint.fileno(), lambda: peer.sendall(b"!")):
            return endpoint.recv(1)

    def callback(self):
        assert asyncio.current_task() is None
        assert self.socket_wait("callback") == b"!"
        Path("callback.returned").touch()

    async def eager_parent(self):
        root = self.current()

        async def child():
            assert self.current() is not root
            assert self.socket_wait("eager") == b"!"
            return 42

        try:
            self.eager_task = asyncio.Task(child(), loop=self.loop, eager_start=True)
            assert self.eager_task.done() and self.eager_task.result() == 42
            print("EAGER_CHILD_RETURNED")
            await self.loop.create_future()
        except asyncio.CancelledError:
            assert self.current() is root
            print("EAGER_ROOT_CANCELLED")
            raise
        finally:
            await asyncio.sleep(0)
            assert self.current() is root
            print("EAGER_ROOT_FINALLY_EXIT")

    def cpu(self):
        task = self.current()
        until = time.monotonic() + 6
        try:
            print("CPU_RUNNING")
            while time.monotonic() < until:
                pass
            raise AssertionError("CPU segment did not receive an interrupt")
        finally:
            assert self.current() is task
            print("CPU_FINALLY")

    def wait_child(self):
        task = self.current()
        # Ordinary subprocess in the runner's group. Closing its stdin also makes it exit on red.
        child = subprocess.Popen([sys.executable, "-I", "-c", "import select; select.select([0], [], [], 30)"],
                                 stdin=subprocess.PIPE)
        print(f"CHILD_PID={child.pid} RUNNER_PID={os.getpid()}")
        try:
            with observe_wait("child", ("61",), child.pid, child.stdin.close):
                child.wait()
            raise AssertionError("child wait returned without cancellation")
        finally:
            child.stdin.close()
            assert self.current() is task
            print("CHILD_FINALLY")

    def wait_timer(self, seconds):
        task = self.current()
        try:
            with observe_wait("timer", ("23", "270"), 0):  # select / pselect6, nfds == 0
                select.select([], [], [], seconds)
            raise AssertionError("timer returned without cancellation")
        finally:
            assert self.current() is task
            print("TIMER_FINALLY")

# Appended to the test runner, without modifying subprocess or its wait/syscall helpers.
import os
from pathlib import Path
import select
import signal
import subprocess
import sys
import threading
import time
from types import ModuleType


_CHILD_EXIT = 23
_child_trials = []


def _await_child_condition(check, message, timeout=3):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        result = check()
        if result:
            return result
        time.sleep(.001)
    raise AssertionError(message)


def _assert_child_reaped(pid):
    assert not Path(f"/proc/{pid}").exists(), f"child {pid} still exists (possibly a zombie)"


class _ChildTrial:
    def __init__(self, kind):
        self.kind = kind
        self.root = Path(kind)
        self.root.mkdir()
        self.children, self.tids, self.read_fds = {}, {}, []
        _child_trials.append(self)

    def args(self, label, group="-"):
        return [sys.executable, "-I", "-c", _CHILD_CODE, str(os.getpid()), str(self.root), label,
                str(group), str(_CHILD_EXIT)]

    def pid(self, label):
        path = self.root / (label + ".ready")
        return _await_child_condition(lambda: int(path.read_text()) if path.exists() else None,
                                      f"{self.kind}: {label} did not become ready")

    def spawn(self, label, group="-", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL):
        self.children[label] = subprocess.Popen(self.args(label, group), stdout=stdout, stderr=stderr)
        assert self.pid(label) == self.children[label].pid

    def pipe(self, *labels):
        read_fd, write_fd = os.pipe()
        self.read_fds.append(read_fd)
        try:
            for label in labels:
                self.spawn(label, stdout=write_fd)
        finally:
            os.close(write_fd)

    def setup(self):
        if self.kind == "multiwriter":
            self.pipe("target", "other-writer")
        elif self.kind == "multipipe":
            self.pipe("target")
            self.pipe("other-writer")
        elif self.kind in ("group-leader", "group-member"):
            leader, member = ("target", "member") if self.kind == "group-leader" else ("sibling", "target")
            self.spawn(leader, group=0)
            self.spawn(member, group=self.pid(leader))
            assert os.getpgid(self.pid(leader)) == os.getpgid(self.pid(member)) == self.pid(leader)
            assert self.pid(leader) != os.getpgrp()
        elif self.kind == "shared-communicate":
            self.spawn("target", stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        elif self.kind == "pipe-read":
            self.spawn("target", stdout=subprocess.PIPE)
        elif self.kind not in ("run", "capture"):
            self.spawn("target")
            assert os.getpgid(self.pid("target")) == os.getpgrp()
        if self.kind in ("run", "group-leader", "wait-any", "wait-group"):
            self.spawn("sibling")
            assert os.getpgid(self.pid("sibling")) == os.getpgrp()

    def block(self, waiter):
        self.tids[waiter] = threading.get_native_id()
        if self.kind == "run":
            subprocess.run(self.args("target"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        elif self.kind == "capture":
            subprocess.run(self.args("target"), capture_output=True)
        elif self.kind in ("wait-any", "wait-group"):
            os.waitpid(-1 if self.kind == "wait-any" else 0, 0)
        elif self.kind.startswith("waitid-"):
            self.wait_id = self.pid("target")
            if self.kind == "waitid-pidfd":
                self.wait_id = os.pidfd_open(self.wait_id)
            try:
                os.waitid(os.P_PID if self.kind == "waitid-pid" else os.P_PIDFD, self.wait_id, os.WEXITED)
            finally:
                if self.kind == "waitid-pidfd":
                    os.close(self.wait_id)
        elif self.kind == "multiwriter":
            os.read(self.read_fds[0], 1)
        elif self.kind == "multipipe":
            poller = select.poll()
            for fd in self.read_fds:
                poller.register(fd, select.POLLIN)
            poller.poll()
        else:
            child = self.children["target"]
            if waiter == "peer":
                self.peer_status = child.wait()
            elif self.kind == "shared-communicate":
                child.communicate()
            elif self.kind == "pipe-read":
                os.read(child.stdout.fileno(), 1)
            else:
                child.wait()

    def observe(self, waiter):
        pid = self.pid("target")
        if waiter == "peer":
            syscalls, argument, value = (61,), 1, pid  # wait4: PID
        elif self.kind in ("capture", "shared-communicate", "multipipe"):
            syscalls, argument, value = (7, 271), 2, 2  # poll/ppoll: two descriptors
            if self.kind != "multipipe":
                out, err = (os.readlink(f"/proc/{pid}/fd/{fd}") for fd in (1, 2))
                assert out.startswith("pipe:[") and err.startswith("pipe:[") and out != err
        elif self.kind in ("pipe-read", "multiwriter"):
            fd = self.read_fds[0] if self.kind == "multiwriter" else self.children["target"].stdout.fileno()
            syscalls, argument, value = (0,), 1, fd  # read: fd
        elif self.kind.startswith("waitid-"):
            syscalls, argument, value = (247,), 2, None  # waitid: PID or pidfd
        else:
            syscalls, argument, value = (61,), 1, {"wait-any": -1, "wait-group": 0}.get(self.kind, pid)

        def sleeping():
            if waiter not in self.tids:
                return False
            try:
                words = Path(f"/proc/self/task/{self.tids[waiter]}/syscall").read_text().split()
            except FileNotFoundError:
                return False
            expected = self.wait_id if value is None else value
            return (len(words) == 9 and words[0].lstrip("-").isdigit() and int(words[0]) in syscalls
                    and (int(words[argument], 16) & 0xffffffff) == (expected & 0xffffffff))

        _await_child_condition(sleeping, f"{self.kind}: {waiter} did not enter syscall {syscalls} with argument {value}")

    def live(self, label):
        pid = self.pid(label)
        assert os.waitid(os.P_PID, pid, os.WEXITED | os.WNOHANG | os.WNOWAIT) is None, f"{label} exited"

    def release(self, label):
        (self.root / (label + ".release")).touch()

    def reject_and_release(self):
        self.observe("owner")
        for label in self.children:
            self.live(label)
        self.release("target")
        if "other-writer" in self.children:
            self.release("other-writer")

    def observe_unreaped(self):
        pid = self.pid("target")
        # WNOWAIT proves exit and the signal without consuming the status from the original waiter.
        info = _await_child_condition(lambda: os.waitid(os.P_PID, pid, os.WEXITED | os.WNOHANG | os.WNOWAIT),
                                      "the reader's child did not exit")
        assert (info.si_code, info.si_status) == (os.CLD_KILLED, signal.SIGKILL)
        assert Path(f"/proc/{pid}/stat").read_text().rpartition(") ")[2].startswith("Z ")

    def allow_reap(self):
        self.reader_status = self.children["target"].wait(timeout=3)

    def verify(self):
        if self.kind in ("multiwriter", "multipipe"):
            for child in self.children.values():
                assert child.wait(timeout=3) == _CHILD_EXIT
                _assert_child_reaped(child.pid)
        _assert_child_reaped(self.pid("target"))
        if self.kind in ("wait-any", "wait-group"):
            assert (self.root / "target.released").exists(), "the broad wait's child did not reach normal exit"
        if "member" in self.children:
            assert self.children["member"].wait(timeout=3) < 0, "the independent group member was not signalled"
            _assert_child_reaped(self.pid("member"))
        if self.kind == "shared-communicate":
            assert self.peer_status < 0, "peer wait did not receive the real signal status"
        if self.kind == "pipe-read":
            assert self.reader_status < 0, "the reader's own wait did not receive a signal status"
        if "sibling" in self.children:
            self.live("sibling")
            self.release("sibling")
            assert self.children["sibling"].wait(timeout=3) == _CHILD_EXIT
            _assert_child_reaped(self.pid("sibling"))

    def close(self):
        for child in self.children.values():
            child.wait(timeout=3)
            for stream in (child.stdout, child.stderr):
                if stream is not None:
                    stream.close()
        while self.read_fds:
            os.close(self.read_fds.pop())
        for path in self.root.glob("*.ready"):
            pid = int(path.read_text())
            _assert_child_reaped(pid)
        _child_trials.remove(self)


def _cleanup_child_trials():
    for trial in list(_child_trials):
        trial.close()


_child_fixture_module = ModuleType("_prk_test_child_wait")
_child_fixture_module.ChildTrial = _ChildTrial
_child_fixture_module.cleanup_child_trials = _cleanup_child_trials
sys.modules[_child_fixture_module.__name__] = _child_fixture_module

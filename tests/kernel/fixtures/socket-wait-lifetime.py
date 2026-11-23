# Appended only to the deployed test runner. Instrument project-owned observation
# boundaries; no changes to socket, os, threading, or any user method.
import os
import select
import socket
import sys
import threading
import time
from types import ModuleType


_socket_trials = {}


class _SocketTrial:
    def __init__(self, wait, phase):
        kind = socket.SOCK_DGRAM if wait == "datagram" else socket.SOCK_STREAM
        self.old, self.peer = socket.socketpair(type=kind)
        self.new, self.other = socket.socketpair()
        self.shared = self.old.dup()
        self.wait_kind = wait
        self.phase = phase
        self.thread = threading.get_native_id()
        self.fd = self.old.fileno()
        self.duplicate = None
        self.replaced = False
        _socket_trials[self.thread] = self

    def replace(self):
        assert not self.replaced
        os.dup2(self.new.fileno(), self.fd, inheritable=False)
        self.replaced = True

    def block(self):
        if self.wait_kind == "read":
            os.read(self.fd, 1)
        elif self.wait_kind in ("poll", "ambiguous"):
            poller = select.poll()
            poller.register(self.fd, select.POLLIN)
            if self.wait_kind == "ambiguous":
                poller.register(self.new.fileno(), select.POLLIN)
            poller.poll()
        elif self.wait_kind == "select":
            select.select([self.fd], [], [])
        else:
            self.old.recv(1)

    def await_syscall(self):
        expected = {"read": {0}, "poll": {7, 271}, "ambiguous": {7, 271}, "select": {23, 270}}
        deadline = time.monotonic() + 3
        while time.monotonic() < deadline:
            with open(f"/proc/self/task/{self.thread}/syscall") as source:
                words = source.read().split()
            if len(words) == 9 and int(words[0]) in expected.get(self.wait_kind, {45}):
                return
            time.sleep(.001)
        raise RuntimeError("worker did not enter its real socket syscall")

    def verify(self, applied):
        assert self.replaced == (self.phase != "none")
        selected = self.old if self.replaced else self.new
        # Check blocking flags before settimeout can affect an alias of the same OFD.
        assert os.get_blocking(self.fd) and os.get_blocking(self.shared.fileno())
        if self.duplicate is not None:
            try:
                os.fstat(self.duplicate)
            except OSError as error:
                assert error.errno == 9  # EBADF: the private pin was closed.
            else:
                raise AssertionError("runner leaked its pinned descriptor")
        selected.settimeout(1)
        self.other.settimeout(1)
        self.other.sendall(b"n")
        assert selected.recv(1) == b"n"
        selected.sendall(b"r")
        assert self.other.recv(1) == b"r"
        if applied:
            for endpoint in (self.shared, self.peer):
                endpoint.settimeout(1)
                assert endpoint.recv(1) == b"", "both sides of the original stream must see EOF"
        else:
            # The original worker was still blocked. Release it without shutdown.
            self.peer.send(b"x")

    def close(self):
        _socket_trials.pop(self.thread)
        for endpoint in (self.old, self.peer, self.new, self.other, self.shared):
            endpoint.close()


# The runner's globals are separate from the bootstrap's __main__ module.
_socket_fixture_module = ModuleType("_prk_test_socket_wait")
_socket_fixture_module._SocketTrial = _SocketTrial
sys.modules[_socket_fixture_module.__name__] = _socket_fixture_module


if "_verify_socket_wait" in globals():
    _real_socket_identity = _socket_identity
    _real_verify_socket_wait = _verify_socket_wait

    def _socket_identity(fd):
        identity = _real_socket_identity(fd)
        trial = next(iter(_socket_trials.values()))
        if fd != trial.fd:
            trial.duplicate = fd
            if trial.phase == "after_dup":
                trial.replace()
        elif trial.duplicate is None and trial.phase == "after_first_identity":
            trial.replace()
        return identity

    def _verify_socket_wait(ctx, cell, thread, tid, sample, selection, first):
        _real_verify_socket_wait(ctx, cell, thread, tid, sample, selection, first)
        trial = _socket_trials[tid]
        if trial.phase == "after_check":
            trial.replace()

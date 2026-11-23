"""In the owned test runner, replay a captured stop token after the same Task resumes."""
import asyncio
import importlib
import socket
import sys
import threading
import time
import types


async def _hold_resumed_socket(witness):
    try:
        runtime = importlib.import_module("_prk_runtime")
        ctx = runtime.current_cell.args[0]
        cell = runtime.current_cell()
        thread = threading.current_thread()
        task = asyncio.current_task()
        old_token = ctx.active_segment.token
        await asyncio.sleep(0)
        assert asyncio.current_task() is task
        new_token = ctx.active_segment.token
        assert new_token is not old_token
        witness.sample = ctx, cell, thread, old_token, new_token
        assert witness.left.recv(32) == b"original socket alive"
    finally:
        witness.left.close()


def _reject_old_segment(witness):
    try:
        deadline = time.monotonic() + 3
        while True:
            if witness.sample is not None:
                ctx, cell, thread, old_token, new_token = witness.sample
                with ctx.condition:
                    tid = thread.native_id
                    sample = _read_syscall(tid)
                    if sample and sample[0] == 45 and sample[1][0] == witness.left.fileno():  # recvfrom
                        # Model the delay between capturing a token and consuming it. The
                        # Task, thread, live cell, native syscall, and socket are real.
                        cell.cancelled = True
                        try:
                            assert _owns_cancelled_worker(ctx, cell, thread, tid, new_token)
                            steps = observe_worker_syscall(ctx, cell, thread, old_token)
                        finally:
                            cell.cancelled = False
                        break
            assert time.monotonic() < deadline, "resumed Task did not enter its socket wait"
            time.sleep(0.002)
        assert [(step["step"], step["status"]) for step in steps] == [("syscall", "skipped")], steps
        witness.right.sendall(b"original socket alive")
    finally:
        witness.right.close()


def _open_async_resume_witness():
    left, right = socket.socketpair()
    return types.SimpleNamespace(left=left, right=right, sample=None)


sys.modules["_prk_async_resume_witness"] = types.SimpleNamespace(
    hold=_hold_resumed_socket, reject_old=_reject_old_segment, open_trial=_open_async_resume_witness,
)

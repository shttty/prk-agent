import asyncio
import threading
from contextlib import contextmanager


def _leave_user_code(ctx, cell):
    with ctx.condition:
        cell.user_thread = None


def evaluate_worker_code(ctx, cell, code):
    """Only the eval, not compilation, result rendering or settlement, is injectable."""
    try:
        try:
            with ctx.condition:
                check_cancelled(ctx, cell)
                cell.user_thread = threading.current_thread()
            return eval(code, ctx.namespace)
        finally:
            _leave_user_code(ctx, cell)
    except KeyboardInterrupt:
        # A queued exception can arrive as the eval returns and interrupt revocation.
        # Once cancellation has been accepted the reader cannot queue another one.
        _leave_user_code(ctx, cell)
        raise


@contextmanager
def protect_runner_call(ctx, cell):
    """No asynchronous exception may interrupt a protocol write or callback bookkeeping."""
    if cell is not None and cell.shared_task is not None:
        with _protect_shared_call(ctx, cell):
            yield
        return
    if cell is None or cell.user_thread is None:
        yield
        return
    with ctx.condition:
        thread, cell.user_thread = cell.user_thread, None
        pending = cell.cancelled
    try:
        yield
    finally:
        with ctx.condition:
            if not cell.cancelled:
                cell.user_thread = thread
            elif not pending:
                raise KeyboardInterrupt()


@contextmanager
def _protect_shared_call(ctx, cell):
    segment = ctx.active_segment
    if segment is None or segment.cell is not cell or segment.protected:
        yield
        return
    try:
        with ctx.condition:
            segment.protected = True
        yield
    finally:
        with ctx.condition:
            segment.protected = False


@contextmanager
def own_private_task(ctx, cell):
    """Explicit thread + await uses its own loop's Task, never the serial lane."""
    with ctx.condition:
        check_cancelled(ctx, cell)
        cell.private_task = (asyncio.get_running_loop(), asyncio.current_task())
    try:
        yield
    finally:
        with ctx.condition:
            cell.private_task = None

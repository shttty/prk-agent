import sys
import time


def _bind_async_exception():
    if sys.implementation.name != "cpython":
        return None
    try:
        from ctypes import PYFUNCTYPE, c_int, c_ulong, py_object, pythonapi
        return PYFUNCTYPE(c_int, c_ulong, py_object)(("PyThreadState_SetAsyncExc", pythonapi))
    except (ImportError, AttributeError):
        return None


_queue_async_exception = _bind_async_exception()


def _stop_step(step, status, evidence, **extra):
    return dict(step=step, status=status, evidence=evidence, observedAt=time.time_ns() // 1_000_000, **extra)


def _inject_worker(ctx, cell, thread):
    if _queue_async_exception is None or not getattr(sys, "_is_gil_enabled", lambda: True)():
        return [_stop_step("inject", "unavailable", "In-process CPython cancellation is unavailable")]
    ident = thread.ident
    if ident is None or not _owns_cancelled_worker(ctx, cell, thread, thread.native_id):
        return [_stop_step("inject", "skipped", "No current cancelled user execution registration")]
    count = _queue_async_exception(ident, KeyboardInterrupt)
    if count == 1:
        steps = [_stop_step("inject", "queued", "CPython queued one exception; worker exit is unconfirmed")]
        steps.extend(observe_worker_syscall(ctx, cell, thread))
        return steps
    if count == 0:
        return [_stop_step("inject", "missed", "CPython found no matching thread state")]
    return [_stop_step("inject", "unknown", "CPython returned an unexpected thread state count")]


def _cancel_shared_root(task, segment):
    # A checkpoint can already be unwinding an async finally on this Task.
    # Don't cancel its new await as a second consequence of the same request.
    if segment is None or not segment.interrupt_delivered:
        task.cancel()


def _cancel_shared_task(ctx, cell):
    task = cell.shared_task
    if task.done():
        return [_stop_step("task", "skipped", "Shared root Task already finished")]
    segment = _current_shared_segment(ctx)
    target_segment = segment if segment is not None and segment.cell is cell else None
    ctx.loop.call_soon_threadsafe(_cancel_shared_root, task, target_segment)
    detail = {}
    if segment is not None and segment.cell is not cell:
        detail = {"targetCellId": cell.id, "blockingCellId": segment.cell.id}
    steps = [_stop_step("task", "queued", "Shared loop received a root Task cancellation request", **detail)]
    if segment is not None and segment.cell is cell and not segment.protected:
        thread, token = segment.thread, segment.token
        if segment.trace is not None and _owns_cancelled_worker(ctx, cell, thread, thread.native_id, token):
            segment.interrupt_requested = True
            steps.append(_stop_step("trace", "armed", "Requested one interrupt at an owned root checkpoint"))
        else:
            steps.append(_stop_step("trace", "skipped", "No currently owned root checkpoint hook"))
        steps.extend(observe_worker_syscall(ctx, cell, thread, token))
    return steps


def cancel_worker(ctx, message):
    """Reader only; hold the same gate used to revoke user execution before teardown."""
    with ctx.condition:
        cell = ctx.cells.get(message["cellId"])
        cancel_isolated_fork(ctx, message["cellId"])
        if cell is not None and not cell.cancelled:
            cell.cancelled = True
            ctx.condition.notify_all()
            if cell.shared_task is not None:
                steps = _cancel_shared_task(ctx, cell)
            else:
                wake_awaitable_callback(cell)
                thread = cell.user_thread
                if cell.private_task is not None:
                    loop, task = cell.private_task
                    loop.call_soon_threadsafe(task.cancel)
                    steps = [_stop_step("task", "queued", "Private worker loop received a Task cancellation request")]
                elif thread is None or thread is not cell.worker or thread.ident is None:
                    steps = [_stop_step("inject", "skipped", "No owned worker in synchronous user code")]
                else:
                    steps = _inject_worker(ctx, cell, thread)
            emit_message(ctx, "cell_state", cellId=cell.id, state="stopping", blockedAt=steps,
                         observedAt=steps[-1]["observedAt"])
        emit_message(ctx, "ack", cellId=message["cellId"], re=message["id"])

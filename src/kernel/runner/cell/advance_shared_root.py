import asyncio
import sys
import threading
from types import coroutine

_shared_current_task = asyncio.current_task


class _SharedSegment:
    def __init__(self, cell, task):
        self.cell = cell
        self.task = task
        self.thread = threading.current_thread()
        self.token = object()
        self.trace = None
        self.interrupt_requested = False
        self.interrupt_delivered = False
        self.protected = False


def _current_shared_segment(ctx):
    # The explicit loop also lets the reader distinguish an eager child Task
    # executing inside a root's send from the registered root itself.
    segment = ctx.active_segment
    if (segment is not None and ctx.cells.get(segment.cell.id) is segment.cell
            and segment.cell.shared_task is segment.task
            and _shared_current_task(ctx.loop) is segment.task):
        return segment
    return None


def _new_shared_trace(ctx, segment):
    runner_globals = globals()

    def trace(frame, event, _arg):
        if frame.f_globals is runner_globals:
            return None
        if event == "call" and _shared_current_task(ctx.loop) is not segment.task:
            return None
        if segment.interrupt_requested and not segment.protected and event in ("line", "return"):
            # Don't interrupt runner bookkeeping or library code it calls. A
            # cell's eval/await, including its Python library calls, is user work.
            caller = frame.f_back
            while caller is not None and caller.f_globals is not runner_globals:
                caller = caller.f_back
            if caller is not None and caller.f_code in (evaluate_async_cell.__code__, _await_value.__code__):
                with ctx.condition:
                    if _current_shared_segment(ctx) is segment and not segment.protected:
                        segment.interrupt_requested = False
                        segment.interrupt_delivered = True
                        raise KeyboardInterrupt()
        return trace

    return trace


def _advance_shared_segment(ctx, cell, advance, value, first):
    task = _shared_current_task(ctx.loop)
    segment = _SharedSegment(cell, task)
    try:
        if sys.gettrace() is None:
            segment.trace = _new_shared_trace(ctx, segment)
            sys.settrace(segment.trace)
        with ctx.condition:
            if task is None or task is not cell.shared_task or ctx.cells.get(cell.id) is not cell:
                raise RuntimeError("Shared execution requires the registered root Task")
            if first and (cell.cancelled or ctx.eof):
                raise asyncio.CancelledError()
            ctx.active_segment = segment
        return advance(value)
    finally:
        with ctx.condition:
            if ctx.active_segment is segment:
                ctx.active_segment = None
            segment.interrupt_requested = False
        if segment.trace is not None and sys.gettrace() is segment.trace:
            sys.settrace(None)
        segment.trace = None


@coroutine
def advance_shared_root(ctx, cell, user_code):
    iterator = user_code.__await__()
    advance, value, first = iterator.send, None, True
    try:
        while True:
            try:
                yielded = _advance_shared_segment(ctx, cell, advance, value, first)
            except StopIteration as result:
                return result.value
            first = False
            try:
                value = yield yielded
            except BaseException as error:
                advance, value = iterator.throw, error
            else:
                advance = iterator.send
    finally:
        iterator.close()

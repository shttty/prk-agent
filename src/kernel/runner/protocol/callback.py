import asyncio
import base64
import json
from contextlib import contextmanager


def request_callback(ctx, channel, payload):
    cell = current_cell(ctx)
    if cell is None:
        raise RuntimeError("Callbacks require the owning active SDK cell")
    with protect_runner_call(ctx, cell):
        with _stage_callback(ctx, cell, channel, payload), ctx.condition:
            ctx.condition.wait_for(lambda: cell.callback_reply is not None or cell.cancelled or ctx.eof)
            if cell.cancelled or ctx.eof:
                _record_callback_interrupt(ctx, cell)
                raise KeyboardInterrupt()
            return _callback_value(cell.callback_reply)


async def request_callback_async(ctx, channel, payload):
    cell = current_cell(ctx)
    if cell is None:
        raise RuntimeError("Callbacks require the owning active SDK cell")
    loop = asyncio.get_running_loop()
    waiter = loop.create_future()
    with _stage_callback(ctx, cell, channel, payload, (loop, waiter)):
        await waiter
        with protect_runner_call(ctx, cell), ctx.condition:
            if (ctx.eof or current_cell(ctx) is not cell
                    or (cell.shared_task is None and cell.cancelled)):
                raise asyncio.CancelledError()
            return _callback_value(cell.callback_reply)


@contextmanager
def _stage_callback(ctx, cell, channel, payload, waiter=None):
    request_id = None
    try:
        with protect_runner_call(ctx, cell):
            with ctx.condition:
                if cell.cancelled or ctx.eof:
                    _record_callback_interrupt(ctx, cell)
                    raise KeyboardInterrupt() if waiter is None else asyncio.CancelledError()
                if cell.callback_id is not None:
                    raise RuntimeError("The owning SDK cell already has a pending callback")
                cell.request_id += 1
                request_id = cell.callback_id = cell.request_id
                cell.callback_waiter = waiter
            encoded = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode()
            if len(encoded) > ctx.limits["maxBytes"]:
                raise ValueError("Callback request exceeds process message budget")
            chunk = min(ctx.options["chunkBytes"], ctx.limits["maxFrameBytes"] // 8)
            for offset in range(0, len(encoded), chunk):
                emit_message(ctx, "callback_chunk", requestId=request_id, channel=channel,
                             data=base64.b64encode(encoded[offset:offset + chunk]).decode("ascii"),
                             final=offset + chunk >= len(encoded))
        yield
    finally:
        if request_id is not None:
            with protect_runner_call(ctx, cell), ctx.condition:
                cell.callback_id = None
                cell.callback_reply = None
                cell.callback_waiter = None
                cell.reply_chunks.clear()


def _record_callback_interrupt(ctx, cell):
    if cell.shared_task is not None:
        segment = _current_shared_segment(ctx)
        if segment is not None and segment.cell is cell:
            segment.interrupt_requested = False
            segment.interrupt_delivered = True


def _callback_value(reply):
    if not reply["ok"]:
        raise RuntimeError(reply.get("error", "Gateway callback failed"))
    return reply.get("value")


def _resolve_callback_waiter(waiter):
    if not waiter.done():
        waiter.set_result(None)


def wake_awaitable_callback(cell):
    # Called under the condition so the waiter cannot be unregistered before scheduling.
    if cell.callback_waiter is not None:
        loop, waiter = cell.callback_waiter
        loop.call_soon_threadsafe(_resolve_callback_waiter, waiter)

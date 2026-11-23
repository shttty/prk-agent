import json
import os
import signal


def read_input(ctx):
    """Only this thread reads stdin; no execution queue is maintained."""
    try:
        while True:
            line = ctx.input.readline(ctx.limits["maxFrameBytes"] + 1)
            if not line:
                return
            if len(line) > ctx.limits["maxFrameBytes"] or not line.endswith(b"\n"):
                raise ValueError("Kernel input exceeds process frame budget")
            message = json.loads(line)
            if not isinstance(message, dict) or message.get("generation") != ctx.generation:
                raise ValueError("Invalid kernel message generation")
            kind = message.get("kind")
            fields = {
                "execute": {"code", "title", "mode", "defaultCellMode", "inputs", "outputs"},
                "initialize": {"source"},
                "clear": set(), "delete": {"name"}, "library": {"entries"},
                "cancel": set(),
                "callback_reply_chunk": {"requestId", "data", "final"},
            }
            if kind not in fields or set(message) - (fields[kind] | {"kind", "id", "generation", "cellId"}):
                raise ValueError("Unsupported kernel command fields")
            if kind == "execute":
                if not isinstance(message.get("code"), str) or not isinstance(message.get("title"), str):
                    raise ValueError("Invalid kernel cell source or title")
                modes = ("thread", "async", "isolated")
                if message.get("defaultCellMode") not in modes or ("mode" in message and message["mode"] not in modes):
                    raise ValueError("Invalid kernel cell mode policy")
            if not isinstance(message.get("cellId"), str):
                raise ValueError("Missing cell identity")
            request = message.get("id")
            if not isinstance(request, int) or isinstance(request, bool) or request <= 0:
                raise ValueError("Invalid kernel request identity")
            if kind == "callback_reply_chunk":
                with ctx.condition:
                    receive_reply(ctx, message)
                    emit_message(ctx, "ack", cellId=message["cellId"], re=request)
            elif kind == "cancel":
                cancel_worker(ctx, message)
            else:
                dispatch_command(ctx, message)
    except BaseException as error:
        emit_message(ctx, "fatal", error=str(error))
    finally:
        with ctx.condition:
            ctx.eof = True
            ctx.condition.notify_all()
            for cell in ctx.cells.values():
                wake_awaitable_callback(cell)
        os.kill(os.getpid(), signal.SIGINT)

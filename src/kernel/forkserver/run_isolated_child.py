import asyncio
import builtins
from functools import partial
import json
from multiprocessing.connection import Connection
import sys
import threading
from types import SimpleNamespace


def current_cell(ctx):
    return ctx.cell if threading.get_ident() == ctx.owner else None


def _send_isolated_json(connection, limit, kind, **fields):
    payload = json.dumps(dict(kind=kind, **fields), separators=(",", ":")).encode("ascii")
    if len(payload) > limit:
        raise ValueError("Isolated cell JSON exceeds process frame budget")
    connection.send_bytes(payload)


def emit_message(ctx, kind, **fields):
    # Reuse owned stream/image framing, but never forward internal display MIME or telemetry.
    if kind in ("stream", "image", "image_omitted"):
        fields.pop("cellId", None)
        _send_isolated_json(ctx.connection, ctx.limits["maxFrameBytes"], kind, **fields)


def _isolated_display(ctx, value, raw=False, metadata=None):
    if current_cell(ctx) is None:
        return
    if raw:
        value = {mime: value[mime] for mime in ("text/plain", "image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp")
                 if mime in value}
    display_value(ctx, value, raw, metadata)


def _isolated_callback(ctx, channel, payload):
    if current_cell(ctx) is None:
        raise RuntimeError("Callbacks require the owning isolated cell")
    if channel not in ("gateway", "describe"):
        raise ValueError("Unsupported isolated callback channel")
    limit = ctx.limits["maxBytes"] + 256
    # Count Python-to-Gateway callback payload bytes as UTF-8, as the runner does.
    request = json.dumps(dict(kind="callback", channel=channel, payload=payload),
                         ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    if len(request) > limit:
        raise ValueError("Isolated callback exceeds process message budget")
    ctx.connection.send_bytes(request)
    reply = json.loads(ctx.connection.recv_bytes(limit))
    if isinstance(reply, dict):
        if reply.get("ok") is True and reply.keys() == {"ok", "value"}:
            return reply["value"]
        if reply.get("ok") is False and reply.keys() == {"ok", "error"} and isinstance(reply["error"], str):
            raise RuntimeError(reply["error"])
    raise ValueError("Invalid isolated callback reply")


def run_isolated_child(data):
    # Only this fork's data endpoint comes here, after closing unrelated fds and setsid().
    configuration = ISOLATED_CONFIGURATION
    limits, options = configuration["processWindow"], configuration["options"]
    frame_limit, pickle_limit = limits["maxFrameBytes"], limits["maxBytes"]
    # JSON can expand one Unicode code point to two six-byte escapes. Reserve room for
    # the envelope and the capped type name even when the configured output cap is larger.
    type_limit = min(64, max(0, (frame_limit - 128) // 24))
    text_limit = min(options["maxOutputChars"], max(0, (frame_limit - 128) // 12 - type_limit))
    with Connection(data.detach()) as connection:
        try:
            source = connection.recv_bytes(frame_limit)
            inputs = connection.recv_bytes(pickle_limit)
        except (EOFError, OSError):
            return 1
        rejection = "INVALID_REQUEST"
        try:
            code, name, aliases = compile_isolated_body(source.decode("utf-8"))
            rejection = "ISOLATED_INPUT"
            namespace = unpickle_cell_values(inputs)
            if type(namespace) is not dict or any(type(key) is not str for key in namespace):
                raise ValueError("Isolated inputs must be a mapping of names to values")
        except BaseException as error:
            error_name, message = describe_isolated_error(error, min(text_limit, 520))
            _send_isolated_json(connection, frame_limit, "rejected", code=rejection,
                                reason=f"{error_name[:type_limit]}: {message}")
            return 1
        _send_isolated_json(connection, frame_limit, "ready")
        try:
            if connection.recv_bytes(3) != b"run":
                return 1
        except (EOFError, OSError):
            return 1

        child_options = dict(options, chunkBytes=min(options["chunkBytes"], max(1, (frame_limit - 128) // 8)))
        ctx = SimpleNamespace(connection=connection, options=child_options, limits=limits,
                              owner=threading.get_ident(), stdout=sys.stdout, stderr=sys.stderr,
                              cell=SimpleNamespace(id="isolated", image_count=0, image_bytes=0))
        def reject_input(*_):
            raise RuntimeError("Ordinary input() is unsupported; use a Gateway ask callback")

        namespace.update(__name__="__main__",
                         __builtins__={**vars(builtins), "print": partial(print_owned, ctx), "help": partial(help_owned, ctx), "input": reject_input},
                         display=partial(_isolated_display, ctx), gateway=_create_gateway(partial(_isolated_callback, ctx)))
        stage = ""
        try:
            local = {}
            exec(code, namespace, local)
            value = asyncio.run(local[name](*(local[alias] for alias in aliases)))
            stage = "Could not serialize isolated return: "
            result = pickle_cell_values(value, pickle_limit)
            stage = ""
            preview, truncated = preview_isolated_value(value, text_limit)
        except BaseException as error:
            error_name, message = describe_isolated_error(error, max(0, text_limit - len(stage)))
            _send_isolated_json(connection, frame_limit, "error", name=error_name[:type_limit], message=stage + message)
            return 1
        _send_isolated_json(connection, frame_limit, "return", type=isolated_type_name(value)[:type_limit], text=preview, truncated=truncated)
        connection.send_bytes(result)
        return 0

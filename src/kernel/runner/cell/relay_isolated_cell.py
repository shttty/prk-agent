import json


_ISOLATED_CALLBACK_OVERHEAD = 256


def _isolated_frame(raw):
    message = json.loads(raw)
    if not isinstance(message, dict) or not isinstance(message.get("kind"), str):
        raise ValueError("Invalid isolated child frame")
    return message


def _isolated_callback(ctx, transport, frame):
    channel = frame.get("channel")
    payload = frame.get("payload")
    if frame.keys() != {"kind", "channel", "payload"} or not isinstance(payload, dict):
        raise ValueError("Invalid isolated callback envelope")
    if channel == "gateway":
        valid = (payload.keys() == {"name", "args"} and isinstance(payload["name"], str)
                 and isinstance(payload["args"], dict))
    elif channel == "describe":
        valid = not payload.keys() - {"name"} and (payload.get("name") is None or isinstance(payload["name"], str))
    else:
        valid = False
    try:
        if not valid:
            raise ValueError("Isolated cells allow only gateway(name, args) and describe(name) callbacks")
        value = request_callback(ctx, channel, payload)
        reply = json.dumps({"ok": True, "value": value}, ensure_ascii=False, separators=(",", ":")).encode()
        if len(reply) > ctx.limits["maxBytes"] + _ISOLATED_CALLBACK_OVERHEAD:
            raise ValueError("Isolated callback reply exceeds process message budget")
    except KeyboardInterrupt:
        reply = b'{"ok":false,"error":"Isolated cell was cancelled"}'
    except Exception as error:
        reply = json.dumps({"ok": False, "error": str(error)[:640]}, separators=(",", ":")).encode()
        if len(reply) > ctx.limits["maxBytes"] + _ISOLATED_CALLBACK_OVERHEAD:
            reply = b'{"ok":false,"error":"Isolated callback failed"}'
    transport.stream.send_bytes(reply)


def _forward_isolated_output(ctx, cell, frame):
    kind = frame["kind"]
    if (kind == "stream" and frame.keys() == {"kind", "stream", "text"}
            and frame["stream"] in ("stdout", "stderr", "result") and isinstance(frame["text"], str)):
        emit_stream(ctx, frame["stream"], frame["text"], cell.id)
    elif kind == "image_omitted" and frame.keys() == {"kind"}:
        emit_message(ctx, kind)
    elif (kind == "image" and frame.keys() == {"kind", "imageId", "mimeType", "data", "final"}
          and type(frame["imageId"]) is int and 0 < frame["imageId"] <= ctx.options["maxImages"]
          and frame["mimeType"] in ("image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp")
          and isinstance(frame["data"], str) and len(frame["data"]) <= ctx.options["chunkBytes"]
          and type(frame["final"]) is bool):
        emit_message(ctx, kind, imageId=frame["imageId"], mimeType=frame["mimeType"],
                     data=frame["data"], final=frame["final"])
    else:
        raise ValueError("Invalid isolated child output frame")


def relay_isolated_cell(ctx, cell, transport):
    frame_limit = ctx.limits["maxFrameBytes"]
    value_limit = ctx.limits["maxBytes"]
    callback_limit = value_limit + _ISOLATED_CALLBACK_OVERHEAD
    result = serialized = None
    while (raw := transport.receive(max(frame_limit, callback_limit))) is not None:
        if result is not None:
            raise ValueError("Unexpected frame after isolated child completion")
        frame = _isolated_frame(raw)
        kind = frame["kind"]
        if len(raw) > (callback_limit if kind == "callback" else frame_limit):
            raise ValueError("Isolated child frame exceeds process budget")
        if kind == "callback":
            if transport.cancelled:
                continue  # Never forward a late callback from buffered output.
            if transport.exit_code is not None:
                raise ValueError("Isolated child exited before its callback completed")
            _isolated_callback(ctx, transport, frame)
        elif (kind == "return" and frame.keys() == {"kind", "type", "text", "truncated"}
              and isinstance(frame["type"], str) and isinstance(frame["text"], str)
              and type(frame["truncated"]) is bool):
            result = frame
            serialized = transport.receive(value_limit)
        elif (kind == "error" and frame.keys() == {"kind", "name", "message"}
              and isinstance(frame["name"], str) and isinstance(frame["message"], str)):
            result = frame
        else:
            _forward_isolated_output(ctx, cell, frame)
    if transport.cancelled:
        raise KeyboardInterrupt()
    if result is None or (result["kind"] == "return" and (transport.exit_code != 0 or not serialized)):
        raise ValueError(f"Isolated child exited without a successful result (exit code {transport.exit_code})")
    return result, serialized

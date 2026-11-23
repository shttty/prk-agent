import base64
import json


def receive_reply(ctx, message):
    cell = ctx.cells.get(message["cellId"])
    request_id = message.get("requestId")
    if (cell is None or cell.cancelled or cell.callback_id is None or cell.callback_reply is not None
            or type(request_id) is not int or request_id != cell.callback_id):
        return
    data = base64.b64decode(message["data"], validate=True)
    if len(cell.reply_chunks) + len(data) > ctx.limits["maxBytes"]:
        raise ValueError("Callback reply exceeds process message budget")
    cell.reply_chunks.extend(data)
    if not message["final"]:
        return
    reply = json.loads(cell.reply_chunks)
    cell.reply_chunks.clear()
    if not isinstance(reply, dict) or type(reply.get("ok")) is not bool or set(reply) - {"ok", "value", "error"}:
        raise ValueError("Invalid callback reply")
    cell.callback_reply = reply
    ctx.condition.notify_all()
    wake_awaitable_callback(cell)

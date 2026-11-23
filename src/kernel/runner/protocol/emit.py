import json
import os


def emit_message(ctx, kind, **payload):
    cell = current_cell(ctx)
    message = {"generation": ctx.generation, "cellId": cell.id if cell is not None else None,
               "kind": kind, **payload}
    if kind == "diagnostic":
        del message["cellId"]
    data = (json.dumps(message, ensure_ascii=True, separators=(",", ":")) + "\n").encode()
    if len(data) > ctx.limits["maxFrameBytes"]:
        raise ValueError("Kernel output exceeds process frame budget")
    with protect_runner_call(ctx, cell), ctx.output_lock:
        view = memoryview(data)
        while view:
            written = os.write(ctx.protocol_fd, view)
            view = view[written:]

import builtins
import sys


def emit_stream(ctx, stream, text, cell_id=None):
    # Non-BMP code points can take twelve bytes when escaped for JSON.
    chunk = min(ctx.options["chunkBytes"], ctx.limits["maxFrameBytes"] // 16)
    kind = "diagnostic" if cell_id is None else "stream"
    for offset in range(0, len(text), chunk):
        emit_message(ctx, kind, cellId=cell_id, stream=stream, text=text[offset:offset + chunk])


def write_owned(ctx, stream, text):
    cell = current_cell(ctx)
    emit_stream(ctx, stream, text, cell.id if cell is not None else None)


class _OwnedWriter:
    def __init__(self, ctx, stream, cell_id, destination):
        self.ctx, self.stream, self.cell_id, self.destination = ctx, stream, cell_id, destination

    def write(self, text):
        emit_stream(self.ctx, self.stream, text, self.cell_id)

    def flush(self):
        self.destination.flush()


def print_owned(ctx, *values, sep=None, end=None, file=None, flush=False):
    cell = current_cell(ctx)
    destination = sys.stdout if file is None else file
    if cell is None or (destination is not ctx.stdout and destination is not ctx.stderr):
        return builtins.print(*values, sep=sep, end=end, file=file, flush=flush)
    stream = "stdout" if destination is ctx.stdout else "stderr"
    writer = _OwnedWriter(ctx, stream, cell.id, destination)
    return builtins.print(*values, sep=sep, end=end, file=writer, flush=flush)

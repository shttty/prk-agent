from contextlib import nullcontext


def finish_command(ctx, cell, kind, **payload):
    returned = payload.pop("isolated_return", None)
    # Keep the committed identity registered until its natural terminal and binding
    # are published. Closing early would let a racing cancel reserve it as a new fork.
    status = nullcontext() if returned is None else returned[3]
    with ctx.condition, status:
        if ctx.maintenance is cell:
            ctx.maintenance = None
        accepted = returned is not None and not (cell.cancelled or ctx.eof)
        if returned is not None and not accepted:
            payload["outcome"] = "aborted"
        if accepted:
            name, value, text, _ = returned
            emit_stream(ctx, "result", text, cell.id)
        del ctx.cells[cell.id]
        wake_awaitable_callback(cell)
        emit_message(ctx, kind, cellId=cell.id, re=cell.message["id"], **payload)
        # Hold intake until the one write follows successful terminal publication.
        # A failed protocol write cannot leave a newly bound value.
        if accepted and name is not None:
            previous = ctx.namespace.get(name)
            ctx.namespace[name] = value
    if accepted and name is not None:
        del previous  # Do not run the replaced value's finalizer under the input gate.


def finish_workers(ctx):
    while True:
        cell, terminal = ctx.completed.get()
        # Only workers leaving their target are handed off here; intake never joins.
        cell.worker.join()
        cell.worker = None
        if terminal is not None:
            kind, payload = terminal
            finish_command(ctx, cell, kind, **payload)
            continue
        with ctx.condition:
            if ctx.eof:
                finish_command(ctx, cell, "cell_end", outcome="aborted")
            else:
                ctx.loop.call_soon_threadsafe(start_async_cell, ctx, cell)

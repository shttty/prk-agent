import threading


def dispatch_command(ctx, message):
    """Reserve capacity on the reader before starting compilation off-reader."""
    cell_id, request = message["cellId"], message["id"]
    execute = message["kind"] == "execute"
    with ctx.condition:
        if (cell_id in ctx.cells or len(ctx.cells) >= ctx.max_active
                or ctx.maintenance is not None
                or (not execute and ctx.cells)):
            emit_message(ctx, "rejected", cellId=cell_id, re=request, code="BUSY")
            return
        cell = RunnerCell(message)
        ctx.cells[cell_id] = cell
        if not execute:
            ctx.maintenance = cell
            ctx.condition.notify_all()
            return
        cell.worker = threading.Thread(target=execute_worker, args=(ctx, cell), name="prk-cell", daemon=True)
    try:
        cell.worker.start()
    except RuntimeError as error:
        emit_message(ctx, "error", cellId=cell.id, name=type(error).__name__, message=str(error), traceback=[])
        finish_command(ctx, cell, "cell_end", outcome="error")

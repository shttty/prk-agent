import asyncio


def start_async_cell(ctx, cell):
    with ctx.condition:
        if ctx.cells.get(cell.id) is not cell:
            return
        body, tail = cell.async_code
        cell.async_code = None
        if ctx.eof or cell.cancelled:
            finish_command(ctx, cell, "cell_end", outcome="aborted")
            return
        # Public Task construction is non-eager on both supported versions;
        # a user-set loop task factory must not run code under intake's gate.
        task = asyncio.Task(_execute_async_root(ctx, cell, body, tail), loop=ctx.loop)
        cell.shared_task = task
        task.add_done_callback(lambda finished: _finish_async_cell(ctx, cell, finished))


async def _execute_async_root(ctx, cell, body, tail):
    try:
        with execution_scope(ctx, cell, "async"):
            await advance_shared_root(ctx, cell, evaluate_async_cell(ctx, body, tail))
    except BaseException as error:
        # SystemExit and KeyboardInterrupt must not escape a Task step.
        try:
            return _execution_failure(ctx, cell, error, closing=ctx.eof)
        except (SystemExit, KeyboardInterrupt):
            # Formatting a user exception can itself call user code.
            emit_message(ctx, "error", cellId=cell.id, name=type(error).__name__,
                         message="Exception formatting was interrupted", traceback=[])
            return "cell_end", {"outcome": "error"}
    return "cell_end", {"outcome": "ok"}


def _finish_async_cell(ctx, cell, task):
    # A pidfd becoming readable is not proof of reap. Poll without consuming
    # the wait status or making another root wait for this cell's child.
    if not poll_waited_child_reap(cell):
        if not ctx.eof:
            ctx.loop.call_later(0.05, _finish_async_cell, ctx, cell, task)
        return
    # EOF can cancel a task before it enters its scope. A reporting error
    # (e.g. an oversized error frame) must not leave its execution slot live.
    kind, payload = "cell_end", {"outcome": "aborted" if task.cancelled() else "error"}
    try:
        if not task.cancelled():
            kind, payload = task.result()
    finally:
        with ctx.condition:
            cell.shared_task = None
            finish_command(ctx, cell, kind, **payload)

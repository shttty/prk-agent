import asyncio
import inspect
import linecache
import sys
import traceback


def _execute_maintenance(ctx, cell):
    with own_cell(ctx, cell):
        check_cancelled(ctx, cell)
        message = cell.message
        kind = message["kind"]
        prelude = sys.modules.get("_prk_codemode")
        try:
            if prelude:
                prelude.begin_cell(message.get("title", kind))
            if kind == "initialize":
                exec(compile(message["source"], "<PRK initialization>", "exec"), ctx.namespace)
            elif kind == "clear":
                for name in tuple(ctx.namespace):
                    if prelude._namespace_user_name(name):
                        del ctx.namespace[name]
            elif kind == "delete":
                prelude.delete_variable(message["name"])
            elif kind == "library":
                prelude._library_apply(message["entries"])
        finally:
            prelude = sys.modules.get("_prk_codemode")
            if prelude:
                prelude._namespace_publish()


async def _execute_private(ctx, cell, body, tail):
    with execution_scope(ctx, cell, "thread"), own_private_task(ctx, cell):
        await evaluate_async_cell(ctx, body, tail)


def _execute_source(ctx, cell):
    check_cancelled(ctx, cell)
    message = cell.message
    source = message["code"]
    filename = "<PRK cell " + cell.id + ">"
    mode, body, tail = compile_cell(source, filename, message.get("mode"), message["defaultCellMode"])
    check_cancelled(ctx, cell)
    if mode == "isolated":
        return execute_isolated(ctx, cell)
    if "inputs" in message or "outputs" in message:
        return _isolated_rejection("INVALID_REQUEST", "inputs and outputs require effective mode 'isolated'")
    linecache.cache[filename] = (len(source), None, source.splitlines(True), filename)
    if mode == "async":
        cell.async_code = (body, tail)
        return None  # The finisher hands off to the loop after this worker exits.
    coroutine = body.co_flags & inspect.CO_COROUTINE or (tail is not None and tail.co_flags & inspect.CO_COROUTINE)
    if coroutine:
        asyncio.run(_execute_private(ctx, cell, body, tail))
    else:
        with execution_scope(ctx, cell, mode):
            evaluate_cell(ctx, cell, body, tail)
    return "cell_end", {"outcome": "ok"}


def _report_execution(ctx, cell, action):
    try:
        return action(ctx, cell)
    except BaseException as error:
        return _execution_failure(ctx, cell, error)


def _execution_failure(ctx, cell, error, *, closing=False):
    if isinstance(error, KeyboardInterrupt):
        emit_message(ctx, "error", cellId=cell.id, name="KeyboardInterrupt", message="", traceback=[])
        return "cell_end", {"outcome": "aborted"}
    if isinstance(error, asyncio.CancelledError) and (cell.cancelled or closing):
        return "cell_end", {"outcome": "aborted"}
    emit_message(ctx, "error", cellId=cell.id, name=type(error).__name__, message=str(error),
                 traceback=traceback.format_exception(type(error), error, error.__traceback__))
    return "cell_end", {"outcome": "error"}


def execute_worker(ctx, cell):
    terminal = ("cell_end", {"outcome": "error"})
    try:
        terminal = _report_execution(ctx, cell, _execute_source)
    finally:
        await_waited_child_reap(cell)
        ctx.completed.put((cell, terminal))


def execute_maintenance(ctx, cell):
    def run(ctx, cell):
        _execute_maintenance(ctx, cell)
        return "cell_end", {"outcome": "ok"}

    kind, payload = _report_execution(ctx, cell, run)
    finish_command(ctx, cell, kind, **payload)

import builtins
from contextvars import ContextVar
import functools
import os
import queue
import signal
import sys
import threading
import types


def run_kernel(configuration):
    if sys.version_info < (3, 9):
        raise RuntimeError("PRK kernel requires Python 3.9 or newer")
    control_input = os.fdopen(os.dup(0), "rb")
    with open(os.devnull, "rb") as execution_input:
        os.dup2(execution_input.fileno(), 0)
    ctx = types.SimpleNamespace(
        generation=configuration["generation"], limits=configuration["processWindow"],
        max_active=configuration["maxActiveCells"], options=configuration["options"],
        condition=threading.Condition(), active_segment=None, start_gate=threading.Lock(), executing=set(),
        output_lock=threading.Lock(), input=control_input, cells={}, maintenance=None,
        completed=queue.SimpleQueue(), eof=False, ownership=ContextVar("prk-cell", default=None),
        forkserver=forkserver,
        namespace={"__name__": "__main__"},
    )
    ctx.options["chunkBytes"] = min(ctx.options["chunkBytes"], ctx.limits["maxFrameBytes"] // 8)
    capture_output(ctx)
    runtime = types.ModuleType("_prk_runtime")
    runtime.namespace = ctx.namespace
    runtime.display = functools.partial(display_value, ctx)
    runtime.current_cell = functools.partial(current_cell, ctx)
    runtime.write = functools.partial(write_owned, ctx)
    runtime.callback = functools.partial(request_callback, ctx)
    runtime.callback_async = functools.partial(request_callback_async, ctx)
    sys.modules["_prk_runtime"] = runtime
    ctx.namespace.update({"_prk_runtime": runtime, "display": runtime.display})

    def reject_input(*_):
        raise RuntimeError("Ordinary input() is unsupported; use a Gateway ask callback")

    ctx.namespace["__builtins__"] = {
        **vars(builtins), "input": reject_input, "print": functools.partial(print_owned, ctx),
    }

    def interrupt(_signal, _frame):
        cell = ctx.maintenance
        if cell is not None and cell.owner is threading.main_thread() and (cell.cancelled or ctx.eof):
            raise KeyboardInterrupt()

    signal.signal(signal.SIGINT, interrupt)
    os.environ["MPLBACKEND"] = "Agg"
    scoped = os.environ.get("PRK_KERNEL_UNSCOPED") != "1"
    loop_ready = threading.Event()
    loop_thread = threading.Thread(target=run_shared_loop, args=(ctx, loop_ready), name="prk-async")
    loop_thread.start()
    loop_ready.wait()
    try:
        emit_message(ctx, "ready", language="python", version=sys.version.split()[0],
                     pid=os.getpid(), pgid=os.getpgrp(), scoped=scoped)
        threading.Thread(target=finish_workers, args=(ctx,), name="prk-finish", daemon=True).start()
        threading.Thread(target=read_input, args=(ctx,), name="prk-input", daemon=True).start()
        while True:
            with ctx.condition:
                ctx.condition.wait_for(lambda: ctx.maintenance is not None or ctx.eof)
                if ctx.eof:
                    break
                cell = ctx.maintenance
            execute_maintenance(ctx, cell)
    finally:
        with ctx.condition:
            ctx.eof = True  # Fence the compiler handoff before stopping the loop.
        ctx.loop.call_soon_threadsafe(ctx.loop_stop.set)
        loop_thread.join()
        prelude = sys.modules.get("_prk_codemode")
        if prelude and not ctx.cells:
            for shutdown in prelude._shutdown:
                shutdown()

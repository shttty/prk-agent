from functools import partial
from types import SimpleNamespace


def create(emit):
    proc = sys.argv[sys.argv.index("--proc") + 1] if "--proc" in sys.argv else "/proc"
    machine = assemble_machine(proc)
    # Keep a short CPU baseline without holding up another module's startup.
    ready_at = time.monotonic() + 0.2
    ctx = SimpleNamespace(emit=emit, machine=machine, interval=30.0, dirs=[],
                          ready_at=ready_at, next_sample=ready_at)
    ctx.handle = partial(handle_command, ctx)
    ctx.tick = partial(tick, ctx)
    return ctx

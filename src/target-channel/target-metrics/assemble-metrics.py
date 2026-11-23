from functools import partial
from types import SimpleNamespace


def create(emit):
    ctx = SimpleNamespace(emit=emit, lock=threading.RLock(), metrics=[], items=[], retired=[],
                          expires_at=0, stopped=False)
    ctx.handle = partial(handle, ctx)
    ctx.tick = partial(tick, ctx)
    ctx.shutdown = partial(shutdown, ctx)
    return ctx

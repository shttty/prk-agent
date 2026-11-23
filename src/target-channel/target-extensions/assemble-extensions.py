from functools import partial
from types import SimpleNamespace


def create(emit):
    cache_root = os.path.expanduser(os.environ.get("PRK_TARGET_CACHE_ROOT", DEFAULT_TARGET_CACHE_ROOT))
    if not os.path.isabs(cache_root):
        raise ValueError("targetCacheRoot must be absolute on target")
    ctx = SimpleNamespace(emit=emit, cache_root=cache_root,
                          root=os.path.join(cache_root, "remote-extensions"),
                          assets={}, uploads={}, verified={}, children={}, generations=set(), scope_cache={},
                          lock=threading.RLock(), closed=False)
    ctx.handle = partial(handle, ctx)
    ctx.shutdown = partial(shutdown, ctx)
    return ctx

def _memory_publish(cell_end=False, periodic=False):
    global _memory_published_oom
    # Serialize samples (including publication) so an older periodic reading cannot overtake a final one.
    with _memory_lock:
        oom_kill = _memory_oom_kill()
        if periodic and not _memory_active and oom_kill == _memory_published_oom:
            return
        current = int((_memory_scope / "memory.current").read_text())
        inactive_file = int(dict(line.split() for line in (_memory_scope / "memory.stat").read_text().splitlines())["inactive_file"])
        _display({"application/x-prk-memory+json": {
            "current": current, "workingSet": max(0, current - inactive_file), "baseline": _memory_baseline, "extra": current - _memory_baseline,
            "scope": str(_memory_scope), "memoryMax": _memory_max, "memorySwapMax": _memory_swap_max,
            "oomKill": oom_kill,
        }}, raw=True, metadata={"prk_memory_cell_end": True} if cell_end else {})
        _memory_published_oom = oom_kill



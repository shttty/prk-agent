def _memory_oom_kill():
    return int(dict(line.split() for line in (_memory_scope / "memory.events").read_text().splitlines()).get("oom_kill", "0"))



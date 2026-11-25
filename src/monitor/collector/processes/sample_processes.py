from collections import defaultdict

PROCESS_ROWS = 128
PROCESS_COMMAND_BYTES = 2048

def _process_stats(proc):
    children, stats = defaultdict(list), {}
    with os.scandir(proc) as entries:
        for entry in entries:
            if not entry.name.isdecimal():
                continue
            try:
                with open(os.path.join(entry.path, "stat"), "rb") as source:
                    text = source.read()
                start, end = text.index(b"("), text.rindex(b")")
                fields = text[end + 2:].split()
                if fields[0] in (b"Z", b"X"):
                    continue
                pid = int(entry.name)
                parent, group, foreground = map(int, (fields[1], fields[2], fields[5]))
                ticks = int(fields[11]) + int(fields[12])
                stats[pid] = (parent, group, foreground, ticks, int(fields[19]), int(fields[21]), text[start + 1:end])
                children[parent].append(pid)
            except (OSError, ValueError, IndexError):
                continue  # The process may exit between listing and opening /proc/PID/stat.
    return children, stats

def _process_command(proc, pid, fallback):
    try:
        with open(os.path.join(proc, str(pid), "cmdline"), "rb") as source:
            text = source.read(PROCESS_COMMAND_BYTES + 1)
        return (text[:PROCESS_COMMAND_BYTES].rstrip(b"\0").replace(b"\0", b" ") or fallback).decode("utf-8", "replace") + ("…" if len(text) > PROCESS_COMMAND_BYTES else "")
    except OSError:
        return fallback.decode("utf-8", "replace")

def sample_processes(ctx, now):
    if not ctx.process_watches:
        ctx.process_baseline = {}
        return
    children, stats = _process_stats(ctx.machine.proc)
    baseline = {}
    hz, page = os.sysconf("SC_CLK_TCK"), os.sysconf("SC_PAGE_SIZE")
    for session_id, roots in ctx.process_watches.items():
        # Reserve each root before walking descendants so one busy tree cannot hide the other roots.
        queue = [pid for pid in roots if pid in stats]
        seen, rows = set(), []
        for pid in queue:
            if len(rows) >= PROCESS_ROWS:
                break
            if pid in seen:
                continue
            seen.add(pid)
            parent, group, foreground, ticks, start, pages, name = stats[pid]
            previous = ctx.process_baseline.get((pid, start))
            cpu = max(0.0, 100 * (ticks - previous[0]) / (hz * (now - previous[1]))) if previous and now > previous[1] else None
            baseline[pid, start] = (ticks, now)
            rows.append({"pid": pid, "parentPid": parent, "group": group, "foregroundGroup": foreground,
                         "command": _process_command(ctx.machine.proc, pid, name),
                         "cpuPercent": cpu, "rssBytes": max(0, pages * page)})
            queue.extend(children[pid])
        ctx.emit({"t": "processes", "sessionId": session_id, "rows": rows,
                  "truncated": len(rows) == PROCESS_ROWS and any(pid not in seen for pid in queue)})
    ctx.process_baseline = baseline

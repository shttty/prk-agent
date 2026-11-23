from pathlib import Path
import gc
import hashlib
import json
import os
import resource
import socket
import subprocess
import sys
import time


def reference(path, number, text):
    return f"{number}#" + hashlib.blake2b((str(Path(path).resolve()) + "\0" + text).encode()).hexdigest()[:3]


def replacement(ref, text, end=None):
    return {"op": "replace", "start": ref, "end": ref if end is None else end, "text": text}


def rejected(path, call):
    before = Path(path).read_bytes()
    try:
        call()
    except (ValueError, TimeoutError) as error:
        assert Path(path).read_bytes() == before, "refusal changed target bytes"
        return error
    raise AssertionError("unsafe write was accepted")


path = Path("filetools-contract.txt")
write(path, "alpha\nbeta\n")
view = read(path)
row = view["lines"][0]
assert row["ref"] == reference(path, 1, "alpha"), row
assert view["total_lines"] == 2 and view["next_offset"] is None, view

# Both files were shown: rejection is salted-path validation, not merely missing authority.
salt_a = Path("contract-salt-a.txt")
write(salt_a, "same text\n")
a_ref = read(salt_a)["lines"][0]["ref"]
for candidate in range(100):
    salt_b = Path(f"contract-salt-b-{candidate}.txt")
    if reference(salt_b, 1, "same text") != a_ref:
        break
else:
    raise AssertionError("could not select different 12-bit salted suffixes")
write(salt_b, "same text\n")
b_ref = read(salt_b)["lines"][0]["ref"]
assert b_ref == reference(salt_b, 1, "same text") and a_ref != b_ref
rejected(salt_b, lambda: edit(salt_b, [replacement(a_ref, "cross-file must not write")]))
assert salt_a.read_bytes() == salt_b.read_bytes() == b"same text\n"

# A duplicate target in a sparse shown window has two equally supported alignments.
ambiguous = Path("contract-ambiguous.txt")
write(ambiguous, "left\ntarget\nright\n")
old = read(ambiguous, offset=2, limit=1)["lines"][0]["ref"]
ambiguous.write_bytes(b"target\nother\ntarget\n")
conflict = rejected(ambiguous, lambda: edit(ambiguous, [replacement(old, "must not guess")]))
assert conflict.context["path"] == str(ambiguous.resolve())
fresh = next(row for row in conflict.context["lines"] if row["text"] == "target")
assert fresh["ref"] == reference(ambiguous, fresh["number"], "target")
edit(ambiguous, [replacement(fresh["ref"], "fresh retry")])
assert ambiguous.read_text().splitlines()[fresh["number"] - 1] == "fresh retry"
assert ambiguous.read_text().splitlines().count("target") == 1

# Read remains streaming and unrestricted by the deliberately tiny edit byte limit.
large = Path("contract-two-million.txt")
rows = 2_000_000
with large.open("wb") as stream:
    for start in range(1, rows + 1, 10000):
        stream.write("".join(f"stream-row-{number:07d}-payload\n" for number in range(start, min(start + 10000, rows + 1))).encode())
gc.collect()

def rss_bytes():
    return int(Path("/proc/self/statm").read_text().split()[1]) * os.sysconf("SC_PAGE_SIZE")


rss_before = rss_bytes()
peak_before = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * 1024
last = read(large, offset=rows - 19)
rss_after = rss_bytes()
peak_after = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * 1024
assert last["total_lines"] == rows and last["next_offset"] is None and not last["truncated"], last
assert [(row["number"], row["text"]) for row in last["lines"]] == [(number, f"stream-row-{number:07d}-payload") for number in range(rows - 19, rows + 1)]
assert all(row["ref"] == reference(large, row["number"], row["text"]) for row in last["lines"])
rss_delta = rss_after - rss_before
peak_delta = peak_after - peak_before
memory_bound = 32 * 1024 * 1024
assert rss_delta <= memory_bound and peak_delta <= memory_bound, {"rss_delta_bytes": rss_delta, "peak_delta_bytes": peak_delta, "bound_bytes": memory_bound}
print("FILETOOLS_MEMORY " + json.dumps({"lines": rows, "file_bytes": large.stat().st_size, "rss_before_bytes": rss_before, "rss_after_bytes": rss_after, "rss_delta_bytes": rss_delta, "peak_before_bytes": peak_before, "peak_after_bytes": peak_after, "peak_delta_bytes": peak_delta, "bound_bytes": memory_bound}))
# Check the configured 64-byte edit override on a small target, avoiding a huge assertion copy.
limited = Path("contract-edit-limit.txt")
limited.write_bytes(b"target\n" + b"padding\n" * 20)
limited_row = read(limited, limit=1)["lines"][0]
rejected(limited, lambda: edit(limited, [replacement(limited_row["ref"], "too large")]))
print("FILETOOLS_EDIT_LIMIT_OK", limited.stat().st_size, "limit", 64)

# Synthetic editor files use a real live local process, never mock editor detection.
# Vim source: src/memline.c block0 + long_to_char/char_to_long,
# https://github.com/vim/vim/blob/master/src/memline.c (pid LE @24, host 40 bytes @68).
editor = Path("contract-editor.txt")
editor.write_bytes(b"editor target\n")
live = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"], stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
exited = subprocess.Popen([sys.executable, "-c", "pass"], stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
exited.wait(timeout=10)
try:
    os.kill(live.pid, 0)
    try:
        os.kill(exited.pid, 0)
    except ProcessLookupError:
        pass
    else:
        raise AssertionError("dead editor PID is unexpectedly live")

    def swap_header(pid, hostname=None):
        header = bytearray(1024)
        header[:2] = b"b0"
        header[2:12] = b"VIM 9.1\0\0\0"
        header[24:28] = pid.to_bytes(4, "little")
        host = (hostname or socket.gethostname()).encode()[:39]
        header[68:68 + len(host)] = host
        return header

    for extension in ("swp", "swo", "swn", "swa", "svz", "saa"):
        swap = editor.with_name("." + editor.name + "." + extension)
        swap.write_bytes(swap_header(live.pid))
        try:
            ref = read(editor)["lines"][0]["ref"]
            error = rejected(editor, lambda: edit(editor, [replacement(ref, "blocked by vim")]))
            assert "vim" in str(error).lower(), error
            error = rejected(editor, lambda: write(editor, "blocked write\n"))
            assert "vim" in str(error).lower(), error
        finally:
            swap.unlink()

    swap = editor.with_name("." + editor.name + ".swp")
    for data in (swap_header(exited.pid), b"unreadable residual swap"):
        swap.write_bytes(data)
        ref = read(editor)["lines"][0]["ref"]
        edit(editor, [replacement(ref, "residual allowed")])
        assert editor.read_bytes() == b"residual allowed\n"
        assert write(editor, "editor target\n")["written"] == len("editor target\n")
        swap.unlink()

    emacs = editor.with_name(".#" + editor.name)
    emacs.symlink_to(f"user@{socket.gethostname()}.{live.pid}:123456")
    try:
        ref = read(editor)["lines"][0]["ref"]
        error = rejected(editor, lambda: edit(editor, [replacement(ref, "blocked by emacs")]))
        assert "emacs" in str(error).lower(), error
        error = rejected(editor, lambda: write(editor, "blocked write\n"))
        assert "emacs" in str(error).lower(), error
    finally:
        emacs.unlink()
    for target in (f"user@{socket.gethostname()}.{exited.pid}:123456", "unparseable-residual-lock"):
        emacs.symlink_to(target)
        ref = read(editor)["lines"][0]["ref"]
        edit(editor, [replacement(ref, "dead emacs allowed")])
        assert editor.read_bytes() == b"dead emacs allowed\n"
        assert write(editor, "editor target\n")["written"] == len("editor target\n")
        emacs.unlink()
finally:
    live.terminate()
    live.wait(timeout=10)

print("FILETOOLS_EDITORS_LOCKS_OK")
print("FILETOOLS_CONTRACT_OK")

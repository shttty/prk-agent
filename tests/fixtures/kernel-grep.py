from pathlib import Path
import hashlib
import os
import re


def ref_for(path, number, text):
    return f"{number}#" + hashlib.blake2b((str(Path(path).resolve()) + "\0" + text).encode()).hexdigest()[:3]


def check_refs(result):
    for file in result["files"]:
        for row in file["lines"]:
            assert re.fullmatch(rf"{row['number']}#[0-9a-f]{{3}}", row["ref"]), row
            if not row["truncated"]:
                assert row["ref"] == ref_for(file["path"], row["number"], row["text"]), row
    return result


root = Path("grep-fixture")
(root / "nested").mkdir(parents=True)
(root / ".git").mkdir()
(root / ".gitignore").write_text("ignored.txt\n", encoding="utf-8")
(root / ".ignore").write_text("also-ignored.txt\n", encoding="utf-8")
(root / "a.py").write_text("before\nneedle Alpha\nafter\n" + "unseen\n" * 30, encoding="utf-8")
(root / "nested" / "b.txt").write_text("needle beta\na.b [x]\nNEEDLE upper\n", encoding="utf-8")
for name in ("ignored.txt", "also-ignored.txt", ".hidden.txt"):
    (root / name).write_text("needle excluded\n", encoding="utf-8")
(root / "binary.dat").write_bytes(b"needle binary\n\x00\xff\n")
# NUL may be beyond rg's initial binary sniff; no partial binary results may escape.
(root / "late-binary.dat").write_bytes(b"needle binary\n" + b"z\n" * 40000 + b"\x00")

result = check_refs(grep("needle", root))
assert result["matches"] == 2, result
assert not result["truncated"]
assert {Path(file["path"]).relative_to(root.resolve()).as_posix() for file in result["files"]} == {"a.py", "nested/b.txt"}
assert all(row["match"] and row["ref"] for file in result["files"] for row in file["lines"])
print(result)

binary = grep("needle", root / "late-binary.dat", limit=1)
assert binary["files"] == [] and binary["matches"] == 0
filtered = grep("needle", root, glob="*.py")
assert filtered["matches"] == 1 and len(filtered["files"]) == 1
assert Path(filtered["files"][0]["path"]).name == "a.py"
case = grep("needle", root, ignore_case=True)
assert case["matches"] == 3, case
fixed = grep("a.b [x]", root, literal=True)
assert fixed["matches"] == 1 and fixed["files"][0]["lines"][0]["text"] == "a.b [x]"
assert grep("a.b [x]", root)["matches"] == 0

view = check_refs(grep("needle", root / "a.py", context=1))
rows = view["files"][0]["lines"]
assert [(row["number"], row["text"], row["match"]) for row in rows] == [(1, "before", False), (2, "needle Alpha", True), (3, "after", False)]
assert all(f"{row['ref']}│{row['text']}" in str(view) for row in rows)
assert ">" + rows[1]["ref"] + "│" in str(view)
a, b = rows[0]["ref"], rows[1]["ref"]
edit(root / "a.py", [
    {"op": "replace", "start": a, "end": a, "text": "context edited"},
    {"op": "replace", "start": b, "end": b, "text": "needle edited"},
])
assert (root / "a.py").read_text().startswith("context edited\nneedle edited\nafter\n")
# A computable ref is not authority: grep has not returned the last line.
path = (root / "a.py").resolve()
unseen = ref_for(path, 33, "unseen")
before = path.read_bytes()
try:
    edit(path, [{"op": "replace", "start": unseen, "end": unseen, "text": "must not write"}])
except ValueError as error:
    assert error.context["path"] == str(path), error.context
else:
    raise AssertionError("grep exposed an unreturned row for editing")
assert path.read_bytes() == before

# Line numbers move; the deterministic salted text suffix remains unchanged.
prior = grep("needle", path)["files"][0]["lines"][0]["ref"]
path.write_text("inserted externally\n" + path.read_text(), encoding="utf-8")
shifted = check_refs(grep("needle", path))["files"][0]["lines"][0]
assert shifted["number"] == 3 and shifted["ref"] == "3#" + prior.split("#")[1]
edit(path, [{"op": "replace", "start": shifted["ref"], "end": shifted["ref"], "text": "needle shifted edit"}])
assert path.read_text().splitlines()[2] == "needle shifted edit"

(root / "overlap.txt").write_text("head\nneedle one\nneedle two\ntail\n", encoding="utf-8")
overlap = grep("needle", root / "overlap.txt", context=1)
assert [(row["number"], row["match"]) for row in overlap["files"][0]["lines"]] == [(1, False), (2, True), (3, True), (4, False)]
assert overlap["matches"] == 2
limited = grep("needle", root / "overlap.txt", context=1, limit=1)
assert limited["matches"] == 1 and limited["limit_reached"] and limited["truncated"]
assert [row["number"] for row in limited["files"][0]["lines"]] == [1, 2, 3]

(root / "many.txt").write_text("needle\n" * 1100, encoding="utf-8")
assert grep("needle", root / "many.txt")["matches"] == 100
over_limit = grep("needle", root / "many.txt", limit=9999)
assert over_limit["matches"] == 1000 and over_limit["limit_reached"]
(root / "context.txt").write_text("padding\n" * 15 + "needle\n" + "padding\n" * 15, encoding="utf-8")
context_cap = grep("needle", root / "context.txt", context=999)
assert [row["number"] for row in context_cap["files"][0]["lines"]] == list(range(6, 27))

long_text = "needle " + "界" * 3000
(root / "long.txt").write_text(long_text + "\n", encoding="utf-8")
long_view = grep("needle", root / "long.txt")
long_row = long_view["files"][0]["lines"][0]
assert long_row["text"] == long_text[:2000]
assert long_row["truncated"] and long_row["omitted_chars"] == len(long_text) - 2000
assert long_view["truncated"]
assert long_row["ref"] == ref_for(root / "long.txt", 1, long_text)
a = long_row["ref"]
edit(root / "long.txt", [{"op": "replace", "start": a, "end": a, "text": "short"}])
assert (root / "long.txt").read_text() == "short\n"

(root / "budget.txt").write_text(("needle " + "界" * 1990 + "\n") * 100, encoding="utf-8")
budget = grep("needle", root / "budget.txt", limit=1000)
assert budget["output_limited"] and budget["truncated"]
assert 1 <= budget["matches"] < 100
assert len(str(budget).encode("utf-8")) <= 50 * 1024
# Even with short lines, many long file headers count against the output cap.
headers = root / "headers"
headers.mkdir()
for number in range(180):
    (headers / (str(number).zfill(3) + "h" * 220 + ".txt")).write_text("needle\n")
header_budget = grep("needle", headers, limit=1000)
assert header_budget["output_limited"] and len(str(header_budget).encode("utf-8")) <= 50 * 1024

empty = grep("absent-pattern", root)
assert empty["files"] == [] and empty["matches"] == 0 and not empty["truncated"]
for pattern, search_path in (("[", root), ("needle", root / "missing")):
    try:
        grep(pattern, search_path)
    except (ValueError, RuntimeError, OSError):
        pass
    else:
        raise AssertionError("search errors must not become no matches")
for options in ({"context": -1}, {"limit": 0}, {"limit": True}, {"context": 1.5}):
    try:
        grep("needle", root, **options)
    except ValueError:
        pass
    else:
        raise AssertionError("invalid grep bounds accepted")

# Literal leading flags and spaces are argv data, not shell options or commands.
(root / "-- odd file.txt").write_text("--needle\n", encoding="utf-8")
assert grep("--needle", root / "-- odd file.txt", literal=True)["matches"] == 1
(root / "bom.txt").write_bytes(b"\xef\xbb\xbfneedle\r\ncontext\r\n")
bom = check_refs(grep("needle", root / "bom.txt", context=1))
assert [(row["number"], row["text"]) for row in bom["files"][0]["lines"]] == [(1, "needle"), (2, "context")]
a = bom["files"][0]["lines"][1]["ref"]
edit(root / "bom.txt", [{"op": "replace", "start": a, "end": a, "text": "changed"}])
assert (root / "bom.txt").read_bytes() == b"\xef\xbb\xbfneedle\r\nchanged\r\n"
# rg and read both count LF-delimited lines; bare CR remains line content.
(root / "cr.txt").write_bytes(b"first\rneedle\rlast\r")
cr = check_refs(grep("needle", root / "cr.txt", context=1))
assert [(row["number"], row["text"], row["match"]) for row in cr["files"][0]["lines"]] == [(1, "first\rneedle\rlast\r", True)]
a = cr["files"][0]["lines"][0]["ref"]
assert read(root / "cr.txt")["lines"][0]["ref"] == a
edit(root / "cr.txt", [{"op": "replace", "start": a, "end": a, "text": "changed\rcontent"}])
assert (root / "cr.txt").read_bytes() == b"changed\rcontent"
(root / "unicode.txt").write_text("前文 needle 后文\n", encoding="utf-8")
assert grep("needle", root / "unicode.txt")["files"][0]["lines"][0]["text"] == "前文 needle 后文"
assert grep("$", root / "unicode.txt")["matches"] == 1

old_cwd = Path.cwd()
try:
    os.chdir(root)
    assert grep("needle", glob="a.py")["matches"] == 1
finally:
    os.chdir(old_cwd)
rg = Path(tool_bin("rg"))
assert rg.is_absolute() and rg.name == "rg" and rg.parent.name == expected_rg_sha
assert hashlib.sha256(rg.read_bytes()).hexdigest() == expected_rg_sha
print("GREP_TOOL_BIN", rg, expected_rg_sha)
print("GREP_BUDGET", len(str(budget).encode("utf-8")), "header_bytes", len(str(header_budget).encode("utf-8")))
print("GREP_SCENARIOS_OK")

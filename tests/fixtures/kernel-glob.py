from pathlib import Path
import os
import subprocess

root = Path("glob fixture")
(root / "nested" / "deep").mkdir(parents=True)
(root / ".hidden-dir").mkdir()
subprocess.run(["git", "init", "--quiet", str(root)], check=True)
(root / ".gitignore").write_text("ignored.txt\n", encoding="utf-8")
(root / ".ignore").write_text("also-ignored.txt\n", encoding="utf-8")
for name in ("z.txt", "a.txt", "nested/b.txt", "nested/deep/c.txt", "ignored.txt",
             "also-ignored.txt", ".hidden.txt", ".hidden-dir/inside.txt", "-- odd;name.txt"):
    (root / name).write_text("fixture\n", encoding="utf-8")
(root / "nested" / "empty.txt").mkdir()
(root / "binary.txt").write_bytes(b"\x00\xff")
(root / "linked-dir").symlink_to("nested", target_is_directory=True)
expected = ["-- odd;name.txt", "a.txt", "binary.txt", "nested/b.txt", "nested/deep/c.txt", "z.txt"]
# First call must fail against the pre-feature kernel, before implementation.
result = glob("**/*.txt", root)
assert result["files"] == expected, result
assert not result["truncated"]
assert glob("*.txt", root)["files"] == expected
assert glob("nested/*.txt", root)["files"] == ["nested/b.txt"]
assert glob("nested/**/*.txt", root)["files"] == ["nested/b.txt", "nested/deep/c.txt"]
assert glob("*.txt", root, hidden=True)["files"] == sorted(expected + [".hidden-dir/inside.txt", ".hidden.txt"])
assert glob(".hidden.txt", root)["files"] == []
assert glob("*.txt", root, gitignore=False)["files"] == sorted(expected + ["also-ignored.txt", "ignored.txt"])
all_files = glob("**/*", root, hidden=True, gitignore=False)["files"]
assert ".gitignore" in all_files and ".ignore" in all_files
assert not any(name.startswith(".git/") or name.startswith("linked-dir/") for name in all_files)
ordering = Path("ordering fixture")
(ordering / "a").mkdir(parents=True)
for name in ("a/b.txt", "a+.txt", "a0.txt"):
    (ordering / name).touch()
# rg traversal orders directory components; a raw full-path byte merge loses a/b.
assert glob("*.txt", ordering)["files"] == ["a/b.txt", "a+.txt", "a0.txt"]
assert glob("-- odd;name.txt", root)["files"] == ["-- odd;name.txt"]
assert glob("*.absent", root)["files"] == []
assert not glob("*.absent", root)["truncated"]
limited = glob("*.txt", root, limit=2)
assert limited["files"] == expected[:2] and limited["limit_reached"] and limited["truncated"]
assert "limit" in str(limited) and "truncated" in str(limited)
exact = glob("*.txt", root, limit=len(expected))
assert exact["files"] == expected and not exact["truncated"] and not exact["limit_reached"]
print("GLOB_LIMIT", limited)

many = root / "many"
many.mkdir()
for number in range(1001):
    (many / f"{number:04}.dat").touch()
assert glob("*.dat", many)["files"] == [f"{number:04}.dat" for number in range(100)]
capped = glob("*.dat", many, limit=9999)
assert capped["files"] == [f"{number:04}.dat" for number in range(1000)] and capped["limit_reached"]
budget_root = root / "budget"
budget_root.mkdir()
for number in range(300):
    (budget_root / (f"{number:03}" + "界" * 75)).touch()
budget = glob("*", budget_root, limit=1000)
assert budget["output_limited"] and budget["truncated"] and not budget["limit_reached"]
assert 0 < len(budget["files"]) < 300
assert len(str(budget).encode("utf-8")) <= 50 * 1024
print("GLOB_BUDGET_BYTES", len(str(budget).encode("utf-8")))
# NUL-delimited rg output must preserve unusual POSIX filenames.
(root / "line\nbreak.txt").touch()
assert glob("*break.txt", root)["files"] == ["line\nbreak.txt"]
assert "\\n" in str(glob("*break.txt", root))
for options in ({"limit": 0}, {"limit": True}, {"limit": 1.5}):
    try:
        glob("*", root, **options)
    except ValueError:
        pass
    else:
        raise AssertionError("invalid glob limit accepted")
for pattern, path in (("[", root), ("*", root / "missing"), ("*", root / "a.txt")):
    try:
        glob(pattern, path)
    except (ValueError, RuntimeError, OSError):
        pass
    else:
        raise AssertionError("glob error became an empty result")
old_cwd = Path.cwd()
try:
    os.chdir(root)
    assert glob("a.txt")["files"] == ["a.txt"]
finally:
    os.chdir(old_cwd)
print("GLOB_SCENARIOS_OK")

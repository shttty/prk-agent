"""Focused real-file checks for the target-channel read/edit/write boundary."""
import codecs
import hashlib
import types
import json
import os
from pathlib import Path
import socket
import stat
import tempfile
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "fixtures"))
from target_files_source import TARGET_FILES_SOURCE

files = types.ModuleType("prk_target_files")
exec(compile(TARGET_FILES_SOURCE, "target_channel/files.py", "exec"), files.__dict__)


class TargetFilesContract(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.module = files.create(lambda event: self.fail("file operations emitted an event"))

    def call(self, op, path="file.txt", **arguments):
        return self.module.handle({"id": 1, "mod": "files", "op": op,
                                   "cwd": str(self.root), "path": str(path), **arguments})

    def file(self, content, name="file.txt"):
        path = self.root / name
        path.write_bytes(content if isinstance(content, bytes) else content.encode())
        return path

    def test_read_returns_only_actual_bounded_page(self):
        path = self.file(codecs.BOM_UTF8 + b"first\r\nsecond\r\nthird\r\n")
        page = self.call("read", offset=2, limit=2)
        self.assertEqual(page["content"], [{"type": "text", "text": "second\nthird\n"}])
        self.assertEqual(page["details"]["path"], str(path.resolve()))
        limited = self.call("read", limit=1)["content"][0]["text"]
        self.assertTrue(limited.startswith("first\n"))
        self.assertIn("offset=2", limited)
        self.assertNotIn("second", limited)
        path.write_bytes(("界" * files.MAX_READ_BYTES).encode())
        text = self.call("read")["content"][0]["text"]
        self.assertLessEqual(len(text.encode()), files.MAX_READ_BYTES)
        self.assertIn("limited within line 1", text)
        self.assertNotIn("\ufffd", text)
        path.write_text("row\n" * (files.MAX_READ_LINES + 1))
        text = self.call("read")["content"][0]["text"]
        self.assertEqual(text.count("row\n"), files.MAX_READ_LINES)
        self.assertIn("offset=2001", text)

    def test_sequential_exact_edits_preserve_bom_crlf_and_bare_cr(self):
        path = self.file(codecs.BOM_UTF8 + b"alpha\r\nbeta\r\nbare\rvalue")
        result = self.call("edit", edits=[
            {"oldText": "\ufeffalpha", "newText": "first"},
            {"oldText": "first\r\nbeta", "newText": "updated\nbeta"},
        ])
        expected = codecs.BOM_UTF8 + b"updated\r\nbeta\r\nbare\rvalue"
        self.assertEqual(path.read_bytes(), expected)
        details = result["details"]
        self.assertEqual(details["hash"], hashlib.sha256(expected).hexdigest())
        self.assertEqual(details["path"], str(path.resolve()))
        self.assertEqual(details["firstChangedLine"], 1)
        self.assertIn("-1 alpha", details["diff"])
        self.assertIn("+1 updated", details["diff"])
        self.assertTrue(details["patch"].startswith("--- " + str(path) + "\n+++ " + str(path) + "\n@@ "))
        self.assertIn("\n-alpha\n+updated\n", details["patch"])
        self.assertLessEqual(len(json.dumps(result, ensure_ascii=False).encode()), files.MAX_RESULT_BYTES)

    def test_ambiguity_and_later_failure_leave_entire_file_unchanged(self):
        path = self.file("aaa\nunique\n")
        before = path.read_bytes()
        cases = [
            [{"oldText": "aa", "newText": "x"}],  # overlapping matches count
            [{"oldText": "unique", "newText": "changed"}, {"oldText": "missing", "newText": "x"}],
            [{"oldText": "UNIQUE", "newText": "x"}],  # no fuzzy matching
            [{"oldText": "", "newText": "x"}],
        ]
        for edits in cases:
            with self.subTest(edits=edits), self.assertRaises(ValueError):
                self.call("edit", edits=edits)
            self.assertEqual(path.read_bytes(), before)
        path.write_bytes(b"")
        self.call("edit", edits=[{"oldText": "", "newText": "created\n"}])
        self.assertEqual(path.read_bytes(), b"created\n")

    def test_atomic_write_preserves_existing_style_mode_and_symlink(self):
        actual = self.file(codecs.BOM_UTF8 + b"before\r\n", "actual.txt")
        actual.chmod(0o640)
        alias = self.root / "alias.txt"
        alias.symlink_to(actual.name)
        result = self.call("write", alias, content="\ufeffafter\nkeep\rbare\n")
        expected = codecs.BOM_UTF8 + b"after\r\nkeep\rbare\r\n"
        self.assertEqual(actual.read_bytes(), expected)
        self.assertTrue(alias.is_symlink())
        self.assertEqual(stat.S_IMODE(actual.stat().st_mode), 0o640)
        self.assertEqual(result["details"], {"path": str(actual.resolve()), "hash": hashlib.sha256(expected).hexdigest()})
        new = self.root / "new" / "nested.txt"
        self.call("write", new, content="\ufeffnew\r\n")
        self.assertEqual(new.read_bytes(), codecs.BOM_UTF8 + b"new\r\n")
        before = actual.read_bytes()
        with patch.object(files.os, "replace", side_effect=OSError("replace denied")):
            with self.assertRaisesRegex(OSError, "replace denied"):
                self.call("write", actual, content="must not become visible")
        self.assertEqual(actual.read_bytes(), before)
        self.assertEqual(list(self.root.glob(".prk-files-*")), [])

    def test_live_vim_and_emacs_locks_reject_edit_and_write(self):
        path = self.file("before\n", ".hidden")
        header = bytearray(108)
        header[:6] = b"b0VIM "
        header[24:28] = os.getpid().to_bytes(4, "little")
        host = socket.gethostname().encode()[:39]
        header[68:108] = host + b"\0" * (40 - len(host))
        vim = self.root / ".hidden.swo"
        emacs = self.root / ".#.hidden"
        for editor, lock in (("vim", vim), ("emacs", emacs)):
            if editor == "vim":
                lock.write_bytes(header)
            else:
                lock.symlink_to("user@" + socket.gethostname() + "." + str(os.getpid()))
            for op, args in (("edit", {"edits": [{"oldText": "before", "newText": "after"}]}),
                             ("write", {"content": "after\n"})):
                with self.subTest(editor=editor, op=op), self.assertRaisesRegex(ValueError, editor):
                    self.call(op, path, **args)
                self.assertEqual(path.read_bytes(), b"before\n")
            lock.unlink()
        header[24:28] = b"\0" * 4
        vim.write_bytes(header)
        self.call("write", path, content="stale locks do not block\n")
        self.assertEqual(path.read_bytes(), b"stale locks do not block\n")

    def test_limits_reject_before_mutation_including_serialized_diff(self):
        path = self.file("a\n")
        absent = self.root / "must-not-exist" / "file.txt"
        with self.assertRaisesRegex(ValueError, "request exceeds"):
            self.call("write", absent, content="é" * files.MAX_REQUEST_BYTES)
        self.assertFalse(absent.parent.exists())
        for replacement in ("r" * (140 * 1024), "\t" * (70 * 1024)):
            with self.subTest(size=len(replacement)), patch.object(files, "_atomic") as atomic:
                with self.assertRaisesRegex(ValueError, "(result|diff/patch) exceeds"):
                    self.call("edit", edits=[{"oldText": "a", "newText": replacement}])
                atomic.assert_not_called()
            self.assertEqual(path.read_bytes(), b"a\n")
        with path.open("wb") as source:
            source.truncate(files.MAX_FILE_BYTES + 1)
        for op, args in (("edit", {"edits": [{"oldText": "a", "newText": "b"}]}),
                         ("write", {"content": "small"})):
            with self.subTest(op=op), self.assertRaisesRegex(ValueError, "200 MiB"):
                self.call(op, **args)
            self.assertEqual(path.stat().st_size, files.MAX_FILE_BYTES + 1)

    def test_large_target_file_edit_returns_only_small_diff_and_hash(self):
        path = self.file((b"padding " * 8 + b"\n") * 85000 + b"unique-old\n")
        self.assertGreater(path.stat().st_size, 5 * 1024 * 1024)
        result = self.call("edit", edits=[{"oldText": "unique-old", "newText": "unique-new"}])
        self.assertLess(len(json.dumps(result).encode()), 4096)
        self.assertEqual(result["details"]["hash"], hashlib.sha256(path.read_bytes()).hexdigest())
        self.assertEqual(result["details"]["firstChangedLine"], 85001)
        self.assertTrue(path.read_bytes().endswith(b"unique-new\n"))

    def test_request_validation_rejects_hidden_fields_and_invalid_types(self):
        path = self.file("before\n")
        for args in ({"offset": True}, {"limit": 2001}, {"limit": 0}, {"hidden": "metadata"}):
            with self.subTest(args=args), self.assertRaises(ValueError):
                self.call("read", **args)
        for args in ({"edits": [{"oldText": "before", "newText": "after", "hidden": 1}]},
                     {"edits": []}, {"edits": [{"oldText": "before", "newText": "bad\0value"}]}):
            with self.subTest(args=args), self.assertRaises(ValueError):
                self.call("edit", **args)
            self.assertEqual(path.read_bytes(), b"before\n")


if __name__ == "__main__":
    unittest.main()

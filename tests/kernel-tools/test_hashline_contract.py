"""Real-file checks for sparse references and the injected target-native write outlet."""

import codecs
import hashlib
import os
from pathlib import Path
import socket
import stat
import subprocess
import sys
import tempfile
import tracemalloc
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src" / "kernel-tools"))
from hashline import HashlineError, Session as HashlineSession

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "fixtures"))
from hashline_reference import reference
from target_files_source import TARGET_FILES_SOURCE

_target_namespace = {"__name__": "target_file_contract"}
exec(compile(TARGET_FILES_SOURCE, "target-files", "exec"), _target_namespace)
_target_files = _target_namespace["create"](lambda event: None)


def execute_file(name, args):
    if name == "read":
        return {"content": [], "details": {}}
    try:
        return _target_files.handle({"id": 1, "mod": "files", "op": name, "cwd": str(Path.cwd()), **args})
    except ValueError as error:
        raise HashlineError(str(error)) from error


def Session(**options):
    return HashlineSession(execute=execute_file, **options)


def replace(ref, text, end=None):
    return {"op": "replace", "start": ref, "end": ref if end is None else end, "text": text}


def insert(ref, text, where="after"):
    return {"op": "insert", "ref": ref, "where": where, "text": text}


def full_hash(path, text):
    return int.from_bytes(hashlib.blake2b((str(path.resolve()) + "\0" + text).encode()).digest()[:8], "big")




class HashlineContract(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.session = Session()

    def file(self, text="alpha\nbeta\ngamma\n", name="file.txt"):
        path = self.root / name
        path.write_bytes(text if isinstance(text, bytes) else text.encode())
        return path

    def rows(self, path, **options):
        return self.session.read(path, **options)["lines"]

    def refuses(self, path, operations, *, session=None):
        before = path.read_bytes()
        with self.assertRaises(ValueError) as caught:
            (session or self.session).edit(path, operations)
        self.assertEqual(path.read_bytes(), before, "refusal changed file bytes")
        return caught.exception

    def check_result(self, result, key="lines"):
        self.assertLessEqual(len(result[key]), 2000)
        self.assertLessEqual(len(str(result).encode()), 50 * 1024)
        self.assertEqual(str(result), repr(result))
        for row in result[key]:
            self.assertRegex(row["ref"], r"^[1-9][0-9]*#[0-9a-f]{3}$")
            self.assertEqual(int(row["ref"].split("#")[0]), row["number"])
            self.assertIs(type(row["omitted"]), bool)
            if row["omitted"]:
                self.assertIsNone(row["text"])
                self.assertIs(type(row["bytes"]), int)
            else:
                self.assertIsInstance(row["text"], str)
                self.assertNotIn("\n", row["text"])
            self.assertIn(row["ref"] + "│", str(result))
        return result

    def test_default_hash_matches_full_blake2b_and_realpath_salt(self):
        path = self.file()
        row = self.rows(path)[0]
        expected = full_hash(path, "alpha")
        self.assertEqual(row["ref"], f"1#{expected >> 52:03x}")
        self.assertEqual(self.session.shown[str(path.resolve())][1], expected)
        wrong = int.from_bytes(hashlib.blake2b((str(path.resolve()) + "\0alpha").encode(), digest_size=8).digest(), "big")
        self.assertNotEqual(expected, wrong)
        self.assertEqual(reference(path, 1, "alpha"), row["ref"])
        self.assertEqual(reference(path, 9, "alpha").split("#")[1], row["ref"].split("#")[1])
        alias = self.root / "alias"
        alias.symlink_to(path.name)
        self.assertEqual(self.rows(alias), self.rows(path))
        self.session.edit(alias, [replace(row["ref"], "alias-edited")])
        self.assertTrue(alias.is_symlink())
        self.assertTrue(path.read_bytes().startswith(b"alias-edited\n"))

    def test_foreign_file_reference_refused_atomically(self):
        left = self.file()
        ref = self.rows(left)[0]["ref"]
        # A displayed suffix is only twelve bits; choose a noncollision rather
        # than make a probabilistic assertion about a temporary pathname.
        for index in range(100):
            right = self.file(name=f"other-{index}")
            own = self.rows(right)[0]["ref"]
            if own != ref:
                break
        else:
            self.fail("could not obtain distinct path salts")
        self.assertNotEqual(full_hash(left, "alpha"), full_hash(right, "alpha"))
        self.refuses(right, [replace(ref, "wrong-file")])
        self.assertEqual(right.read_bytes(), left.read_bytes())

    def test_unshown_endpoints_interior_and_new_session_refused(self):
        path = self.file()
        first = self.rows(path, limit=1)[0]["ref"]
        last = self.rows(path, offset=3, limit=1)[0]["ref"]
        self.assertEqual(set(self.session.shown[str(path)]), {1, 3})
        self.refuses(path, [replace(first, "unread-interior", last)])
        # A refusal intentionally displays fresh context; use a fresh sparse
        # session to test an unshown endpoint independently of that display.
        sparse = Session()
        sparse.read(path, limit=1)
        self.refuses(path, [replace(last, "unread-endpoint")], session=sparse)
        fresh = Session()
        self.refuses(path, [replace(first, "old-session")], session=fresh)
        fresh.read(path, limit=1)
        fresh.edit(path, [replace(first, "fresh-read-authorized")])
        self.assertTrue(path.read_bytes().startswith(b"fresh-read-authorized\n"))

    def test_full_hash_not_just_suffix_validates_external_interior(self):
        path = self.file("left\nmiddle\nright\n")
        rows = self.rows(path)
        direct = Session()
        direct.read(path, offset=2, limit=1)
        old = rows[1]["ref"]
        for index in range(200000):
            text = f"collision-{index}"
            if reference(path, 2, text) == old:
                break
        else:
            self.fail("no twelve-bit collision found")
        self.assertNotEqual(full_hash(path, text), full_hash(path, "middle"))
        path.write_text(f"left\n{text}\nright\n")
        self.refuses(path, [replace(old, "same-suffix-is-not-authority")], session=direct)
        error = self.refuses(path, [replace(rows[0]["ref"], "must-not-write", rows[2]["ref"])])
        self.assertIsInstance(error, HashlineError)
        self.assertTrue(any(row["text"] == text for row in error.context["lines"]))
        current = next(row["ref"] for row in error.context["lines"] if row["text"] == text)
        self.session.edit(path, [replace(current, "fresh-context")])
        self.assertEqual(path.read_bytes(), b"left\nfresh-context\nright\n")

    def test_external_endpoint_and_far_interior_changes_are_atomic(self):
        for number in (1, 8, 15):
            with self.subTest(number=number):
                path = self.file("".join(f"row-{i}\n" for i in range(1, 16)))
                self.session = Session()
                rows = self.rows(path)
                lines = path.read_text().splitlines()
                lines[number - 1] = "external-change"
                path.write_text("\n".join(lines) + "\n")
                error = self.refuses(path, [replace(rows[0]["ref"], "no", rows[-1]["ref"])])
                self.check_result(error.context)
                self.assertIn("external-change", [row["text"] for row in error.context["lines"]])

    def test_top_insert_delete_alignment_and_window_translation(self):
        for external in ("prefix\na\nb\nc\nd\n", "b\nc\nd\n"):
            with self.subTest(external=external):
                path = self.file("a\nb\nc\nd\n")
                self.session = Session()
                old = self.rows(path)
                path.write_text(external)
                diff = self.session.edit(path, [replace(old[2]["ref"], "C")])
                self.check_result(diff, "diff")
                self.assertEqual(path.read_text(), external.replace("c\n", "C\n"))
                new_number = external.splitlines().index("d") + 1
                shifted = reference(path, new_number, "d")
                self.assertEqual(self.session.shown[str(path)][new_number], full_hash(path, "d"))
                self.session.edit(path, [replace(shifted, "D")])
                self.assertIn("C\nD\n", path.read_text())

    def test_fresh_page_overlapping_stale_window_uses_displayed_coordinate(self):
        for refresh in ("read", "grep"):
            with self.subTest(refresh=refresh):
                path = self.file("before\nneedle\nafter\n", name=refresh)
                session = Session()
                session.read(path)
                path.write_bytes(b"prefix\nbefore\nneedle\nafter\n")
                if refresh == "read":
                    ref = session.read(path, offset=3, limit=1)["lines"][0]["ref"]
                else:
                    ref = session.grep([{"path": path, "number": 3, "text": "needle", "match": True}])["files"][0]["lines"][0]["ref"]
                session.edit(path, [replace(ref, "updated")])
                self.assertEqual(path.read_bytes(), b"prefix\nbefore\nupdated\nafter\n")

    def test_alignment_uses_contiguous_context_with_duplicate_lines(self):
        path = self.file("unique-left\nrepeat\nrepeat\nunique-right\n")
        old = self.rows(path)
        path.write_text("prefix\nunique-left\nrepeat\nrepeat\nunique-right\n")
        self.session.edit(path, [replace(old[1]["ref"], "first-repeat")])
        self.assertEqual(path.read_text(), "prefix\nunique-left\nfirst-repeat\nrepeat\nunique-right\n")

    def test_large_repetitive_window_ignores_autojunk_and_translates_every_equal_row(self):
        original = ["first"] + ["repeated-middle"] * 300 + ["bottom"]
        path = self.file("\n".join(original) + "\n")
        old = self.rows(path)
        path.write_text("\n".join(["external-top", *original[:-1], "external-bottom"]) + "\n")
        self.session.edit(path, [replace(old[0]["ref"], "first"), replace(old[150]["ref"], "our-middle-change")])
        current = path.read_text().splitlines()
        self.assertEqual(current[151], "our-middle-change")
        self.assertEqual(current[0], "external-top")
        self.assertEqual(current[-1], "external-bottom")
        for index in range(301):
            if index != 150:
                self.assertEqual(self.session.shown[str(path)][index + 2], full_hash(path, original[index]))

    def test_repetitive_range_relocation_validates_all_interior_rows(self):
        path = self.file("first\n" + "repeat\n" * 300 + "bottom\n")
        rows = self.rows(path)
        path.write_text("prefix\nfirst\n" + "repeat\n" * 300 + "external-bottom\n")
        self.session.edit(path, [replace(rows[1]["ref"], "bulk", rows[300]["ref"])])
        self.assertEqual(path.read_bytes(), b"prefix\nfirst\nbulk\nexternal-bottom\n")

    def test_ambiguous_relocation_refuses_then_context_allows_retry(self):
        path = self.file("left\ntarget\nright\n")
        old = self.rows(path, offset=2, limit=1)[0]["ref"]
        path.write_text("target\nother\ntarget\n")
        error = self.refuses(path, [replace(old, "ambiguous")])
        self.assertIn("ambiguous", str(error))
        self.check_result(error.context)
        target = error.context["lines"][2]
        self.session.edit(path, [replace(target["ref"], "explicit-third")])
        self.assertEqual(path.read_bytes(), b"target\nother\nexplicit-third\n")

    def test_equal_window_copies_are_ambiguous_despite_matcher_choice(self):
        path = self.file("left\ntarget\nright\n")
        old = self.rows(path)
        path.write_text("prefix\nleft\ntarget\nright\nseparator\nleft\ntarget\nright\n")
        self.refuses(path, [replace(old[1]["ref"], "must-not-guess")])

    def test_alignment_window_bound_and_internal_insert_delete(self):
        path = self.file("a\nb\nc\n")
        small = Session(align_window=1)
        old = small.read(path)["lines"]
        path.write_text("x\ny\na\nb\nc\n")
        self.refuses(path, [replace(old[1]["ref"], "too-far")], session=small)
        for external in ("a\ninserted\nb\nc\n", "a\nc\n"):
            with self.subTest(external=external):
                path.write_text("a\nb\nc\n")
                self.session = Session()
                rows = self.rows(path)
                path.write_text(external)
                self.refuses(path, [replace(rows[0]["ref"], "range", rows[-1]["ref"])])

    def test_unrelated_external_change_keeps_fast_edit_and_invalidates_stale_row(self):
        path = self.file("a\nb\nc\nd\ne\nf\ng\n")
        old = self.rows(path)
        path.write_text("a\nb\nc\nd\ne\nexternal\ng\n")
        self.session.edit(path, [replace(old[1]["ref"], "B")])
        self.assertEqual(path.read_bytes(), b"a\nB\nc\nd\ne\nexternal\ng\n")
        self.assertNotIn(6, self.session.shown[str(path)])
        self.assertEqual(self.session.shown[str(path)][7], full_hash(path, "g"))

    def test_batch_order_nonoverlap_and_translated_old_coordinates(self):
        path = self.file("a\nb\nc\nd\ne\nf\n")
        before_b = "before-b"
        while reference(path, 2, before_b) == reference(path, 2, "b"):
            before_b += "!"
        rows = self.rows(path)
        diff = self.session.edit(path, [replace(rows[4]["ref"], "E"),
                                        insert(rows[1]["ref"], before_b, "before"),
                                        replace(rows[2]["ref"], "CD", rows[3]["ref"])])
        self.assertEqual(path.read_bytes(), f"a\n{before_b}\nb\nCD\nE\nf\n".encode())
        self.check_result(diff, "diff")
        self.assertEqual(self.session.shown[str(path)][3], full_hash(path, "b"))
        self.assertEqual(self.session.shown[str(path)][6], full_hash(path, "f"))
        self.refuses(path, [replace(rows[1]["ref"], "old-coordinate")])
        self.session.edit(path, [replace(reference(path, 3, "b"), "B")])
        self.assertIn(f"{before_b}\nB\nCD".encode(), path.read_bytes())

    def test_diff_new_and_context_rows_chain_and_noop_preserves_authority(self):
        path = self.file()
        rows = self.rows(path)
        replacement = "BETA"
        while reference(path, 2, replacement) == rows[1]["ref"]:
            replacement += "!"
        diff = self.session.edit(path, [replace(rows[1]["ref"], replacement)])
        added = next(row for row in diff["diff"] if row["kind"] == "+")
        removed = next(row for row in diff["diff"] if row["kind"] == "-")
        context = next(row for row in diff["diff"] if row["kind"] == " ")
        self.assertEqual(removed["ref"], rows[1]["ref"])
        self.refuses(path, [replace(removed["ref"], "expired")])
        self.session.edit(path, [replace(added["ref"], "BETA-2")])
        noop = self.session.edit(path, [replace(context["ref"], context["text"])])
        self.assertEqual(noop["diff"], [])
        self.assertFalse(noop["truncated"])
        self.session.edit(path, [replace(context["ref"], "context-edit")])
        self.assertIn(b"context-edit\n", path.read_bytes())

    def test_own_insert_delete_shifts_unreturned_sparse_rows(self):
        path = self.file("".join(f"row-{i}\n" for i in range(1, 31)))
        first = self.rows(path, limit=1)[0]["ref"]
        last = self.rows(path, offset=30, limit=1)[0]["ref"]
        diff = self.session.edit(path, [insert(first, "new-1\nnew-2")])
        self.assertEqual(self.session.shown[str(path)][32], full_hash(path, "row-30"))
        self.assertNotIn(30, self.session.shown[str(path)])
        self.assertFalse(any(row["number"] == 32 for row in diff["diff"]))
        self.refuses(path, [replace(last, "old-coordinate")])
        self.session.edit(path, [replace(reference(path, 32, "row-30"), "tail")])
        new = [row for row in diff["diff"] if row["kind"] == "+"]
        self.session.edit(path, [replace(new[0]["ref"], "", new[1]["ref"])])
        self.assertEqual(self.session.shown[str(path)][30], full_hash(path, "tail"))
        self.session.edit(path, [replace(reference(path, 30, "tail"), "done")])
        self.assertTrue(path.read_bytes().endswith(b"done\n"))

    def test_overlapping_or_invalid_batch_never_partially_writes(self):
        path = self.file("a\nb\nc\nd\ne\n")
        rows = self.rows(path)
        refs = [row["ref"] for row in rows]
        cases = [
            [replace(refs[0], "valid"), {"op": "unknown", "ref": refs[4], "text": "bad"}],
            [replace(refs[0], "x", refs[3]), replace(refs[2], "y", refs[4])],
            [replace(refs[0], "x", refs[3]), insert(refs[1], "inside")],
            [insert(refs[2], "x"), insert(refs[2], "y")],
            [replace(refs[4], "reverse", refs[1])],
            [replace(1, "numeric")], [],
            [replace(refs[0], "NUL\0")],
            [insert(refs[0], "x", "elsewhere")],
            [dict(replace(refs[0], "x"), extra=True)],
        ]
        for operations in cases:
            with self.subTest(operations=operations):
                self.refuses(path, operations)

    def test_bom_crlf_eof_and_payload_newline_normalization(self):
        for bom in (b"", codecs.BOM_UTF8):
            for eol in (b"\n", b"\r\n"):
                for final in (False, True):
                    with self.subTest(bom=bom, eol=eol, final=final):
                        suffix = eol if final else b""
                        path = self.file(bom + eol.join((b"left", b"middle", b"right")) + suffix)
                        self.session = Session()
                        rows = self.rows(path)
                        self.assertEqual([row["text"] for row in rows], ["left", "middle", "right"])
                        self.session.edit(path, [replace(rows[1]["ref"], "new\nrows\n"), insert(rows[2]["ref"], "tail\r\n")])
                        self.assertEqual(path.read_bytes(), bom + eol.join((b"left", b"new", b"rows", b"right", b"tail")) + suffix)

    def test_bare_cr_is_content_and_partial_chunk_eof_is_not_lost(self):
        for data in (b"x", b"first\rneedle\rlast\r", b"x" * 8191 + b"\r\n", b"x" * 8192 + b"z", "界".encode() * 3000 + b"\r"):
            with self.subTest(length=len(data)):
                path = self.file(data)
                self.session = Session()
                row = self.rows(path)[0]
                expected = data[:-2] if data.endswith(b"\r\n") else data
                self.assertEqual(row["text"], expected.decode())
                self.assertEqual(row["ref"], reference(path, 1, expected.decode()))
                self.session.edit(path, [replace(row["ref"], "new\rcontent")])
                self.assertEqual(path.read_bytes(), b"new\rcontent" + (b"\r\n" if data.endswith(b"\r\n") else b""))

    def test_bare_cr_payload_at_unterminated_eof_is_not_stripped(self):
        for payload in ("new\r", "new\rcontent\r"):
            path = self.file(b"old")
            self.session = Session()
            ref = self.rows(path)[0]["ref"]
            diff = self.session.edit(path, [replace(ref, payload)])
            self.assertEqual(path.read_bytes(), payload.encode())
            added = next(row for row in diff["diff"] if row["kind"] == "+")
            self.assertEqual(added["text"], payload)
            self.assertEqual(added["ref"], reference(path, 1, payload))

    def test_terminal_blank_adds_eof_lf_and_other_edits_preserve_it(self):
        for bom in (b"", codecs.BOM_UTF8):
            for eol in (b"\n", b"\r\n"):
                for final in (False, True):
                    suffix = eol if final else b""
                    cases = [
                        (lambda rows: [insert(rows[1]["ref"], "")],
                         eol.join((b"first", b"last", b"")) + suffix, [(3, "")]),
                        (lambda rows: [replace(rows[1]["ref"], "x\n")],
                         eol.join((b"first", b"x")) + suffix, [(2, "x")]),
                        (lambda rows: [replace(rows[1]["ref"], "x\n\n")],
                         eol.join((b"first", b"x", b"")) + suffix, [(2, "x"), (3, "")]),
                        (lambda rows: [replace(rows[0]["ref"], "committed"), insert(rows[1]["ref"], "")],
                         eol.join((b"committed", b"last", b"")) + suffix, [(1, "committed"), (3, "")]),
                    ]
                    for operations, expected, added in cases:
                        with self.subTest(bom=bom, eol=eol, final=final, added=added):
                            path = self.file(bom + eol.join((b"first", b"last")) + suffix)
                            self.session = Session()
                            result = self.session.edit(path, operations(self.rows(path)))
                            self.assertEqual(path.read_bytes(), bom + expected)
                            self.check_result(result, "diff")
                            self.assertEqual([(row["number"], row["text"]) for row in result["diff"] if row["kind"] == "+"], added)
                            self.assertEqual([row["ref"] for row in result["diff"] if row["kind"] == "+"],
                                             [reference(path, number, text) for number, text in added])
        path = self.file(b"first\nlast")
        self.session.write(path, "first\nlast\n\n")
        self.assertEqual(path.read_bytes(), b"first\nlast\n\n")

    def test_empty_bom_only_delete_all_and_blank_insert(self):
        for bom in (b"", codecs.BOM_UTF8):
            with self.subTest(bom=bom):
                path = self.file(bom)
                self.session = Session()
                empty = self.rows(path)[0]
                self.assertEqual(empty["text"], "")
                first = self.session.edit(path, [replace(empty["ref"], "first")])
                added = next(row["ref"] for row in first["diff"] if row["kind"] == "+")
                self.assertEqual(path.read_bytes(), bom + b"first")
                deleted = self.session.edit(path, [replace(added, "")])
                self.assertEqual(path.read_bytes(), bom)
                blank = next(row["ref"] for row in deleted["diff"] if row["kind"] == "+" and row["text"] == "")
                self.assertEqual(blank, empty["ref"], "refs are deterministic, not allocated identities")
                self.session.edit(path, [replace(blank, "restored")])
                self.session.edit(path, [insert(reference(path, 1, "restored"), "", "before")])
                self.assertEqual(path.read_bytes(), bom + b"\nrestored")

    def test_mixed_newlines_untouched_rows_stay_byte_identical(self):
        path = self.file(b"one\r\ntwo\nthree\r\nlast")
        rows = self.rows(path)
        self.session.edit(path, [replace(rows[1]["ref"], "TWO")])
        self.assertEqual(path.read_bytes(), b"one\r\nTWO\r\nthree\r\nlast")

    def test_long_line_omitted_but_full_hash_replaces_whole_line(self):
        text = "界" * 30000
        path = self.file("left\n" + text + "\nright\n")
        page = self.check_result(self.session.read(path))
        row = page["lines"][1]
        self.assertTrue(row["omitted"])
        self.assertEqual(row["bytes"], len(text.encode()))
        self.assertEqual(row["ref"], reference(path, 2, text))
        self.assertEqual(self.session.shown[str(path)][2], full_hash(path, text))
        self.session.edit(path, [replace(row["ref"], "short")])
        self.assertEqual(path.read_bytes(), b"left\nshort\nright\n")

    def test_binary_utf16_utf32_invalid_utf8_rejected_without_changes(self):
        data_cases = [b"a\0b", b"x\n" * 10000 + b"\0", b"bad\xff", b"\xe7\x95",
                      "hello".encode("utf-16"), codecs.BOM_UTF16_BE + "hi".encode("utf-16-be"),
                      "hello".encode("utf-32"), codecs.BOM_UTF32_BE + "hi".encode("utf-32-be")]
        for data in data_cases:
            with self.subTest(prefix=data[:8]):
                path = self.file(data)
                fresh = Session()
                with self.assertRaises(ValueError):
                    fresh.read(path, offset=10001 if data.startswith(b"x\n") else 1)
                self.assertNotIn(str(path), fresh.shown)
                self.assertEqual(path.read_bytes(), data)
        path = self.file()
        row = self.rows(path)[0]
        for data in data_cases:
            path.write_bytes(data)
            self.refuses(path, [replace(row["ref"], "no")])

    def test_pagination_stops_before_unread_tail_and_uses_integer_offsets(self):
        path = self.file("".join(f"row-{i:04}\n" for i in range(1, 2206)))
        page = self.check_result(self.session.read(path))
        self.assertEqual(len(page["lines"]), 2000)
        self.assertIsNone(page["total_lines"])
        self.assertEqual(page["next_offset"], 2001)
        self.assertTrue(page["truncated"])
        self.assertEqual(len(self.session.shown[str(path)]), 2000)
        tail = self.check_result(self.session.read(path, offset=2001))
        self.assertEqual(tail["total_lines"], 2205)
        self.assertIsNone(tail["next_offset"])
        self.assertFalse(tail["truncated"])
        self.assertEqual(tail["lines"][0]["number"], 2001)
        with self.assertRaises(ValueError):
            self.session.read(path, offset=2206)
        # The next line is not decoded/hashed merely to discover continuation.
        path = self.file(b"first\n\xff\n")
        self.session = Session()
        first = self.session.read(path, limit=1)
        self.assertEqual(first["lines"][0]["text"], "first")
        self.assertIsNone(first["total_lines"])
        self.assertEqual(set(self.session.shown[str(path)]), {1})
        with self.assertRaises(ValueError):
            self.session.read(path, offset=2)

    def test_byte_cap_paginates_normal_lines_without_omitting_them(self):
        path = self.file("".join("界" * 60 + str(i) + "\n" for i in range(800)))
        page = self.check_result(self.session.read(path))
        self.assertLess(len(page["lines"]), 800)
        self.assertTrue(page["truncated"])
        self.assertFalse(any(row["omitted"] for row in page["lines"]))
        self.assertEqual(page["next_offset"], page["lines"][-1]["number"] + 1)
        self.assertEqual(set(self.session.shown[str(path)]), {row["number"] for row in page["lines"]})
        next_page = self.session.read(path, offset=page["next_offset"], limit=1)
        self.assertEqual(next_page["lines"][0]["number"], page["next_offset"])

    def test_last_page_two_million_lines_uses_bounded_sparse_memory(self):
        path = self.root / "two-million.txt"
        with path.open("wb") as stream:
            chunk = b"row\n" * 1000
            for _ in range(2000):
                stream.write(chunk)
        session = Session()
        tracemalloc.start()
        try:
            page = session.read(path, offset=1_999_998, limit=3)
            current, peak = tracemalloc.get_traced_memory()
        finally:
            tracemalloc.stop()
        self.assertEqual([row["number"] for row in page["lines"]], [1_999_998, 1_999_999, 2_000_000])
        self.assertEqual(page["total_lines"], 2_000_000)
        self.assertEqual(len(session.shown[str(path)]), 3)
        self.assertLess(peak, 2 * 1024 * 1024, "read retained an unshown prefix")
        print(f"HASHLINE_STREAM_MEMORY lines=2000000 current_bytes={current} peak_bytes={peak}")

    def test_large_diff_only_authorizes_returned_new_context_rows(self):
        path = self.file("".join(f"old-{i}\n" for i in range(2205)))
        head = self.rows(path)
        tail = self.rows(path, offset=2001)
        diff = self.check_result(self.session.edit(path, [replace(head[0]["ref"], "\n".join(f"new-{i}" for i in range(2205)), tail[-1]["ref"])]), "diff")
        self.assertTrue(diff["truncated"])
        new_rows = [row for row in diff["diff"] if row["kind"] != "-"]
        self.assertTrue(any(row["kind"] == "+" for row in new_rows))
        self.assertEqual(set(self.session.shown[str(path)]), {row["number"] for row in new_rows})
        self.assertNotIn(2205, self.session.shown[str(path)])
        self.session.edit(path, [replace(new_rows[0]["ref"], "chain")])
        self.assertTrue(path.read_bytes().startswith(b"chain\n"))

    def test_edit_size_limit_does_not_restrict_read_or_grep(self):
        path = self.file("0123456789\ntail\n")
        session = Session(max_edit_bytes=4)
        row = session.read(path)["lines"][0]
        result = session.grep([{"path": path, "number": 2, "text": "tail", "match": True}])
        self.assertEqual(result["matches"], 1)
        error = self.refuses(path, [replace(row["ref"], "small")], session=session)
        self.assertIn("bash/Python", str(error))

    def test_whole_file_write_preserves_style_and_clears_only_its_state(self):
        other = self.file("untouched\n", name="other")
        self.rows(other)
        for bom in (b"", codecs.BOM_UTF8):
            for eol in (b"\n", b"\r\n"):
                for final in (False, True):
                    with self.subTest(bom=bom, eol=eol, final=final):
                        path = self.file(bom + b"old" + eol + b"tail")
                        old = self.rows(path)[0]["ref"]
                        payload = "new\rcontent\nnext" + ("\r\n" if final else "")
                        self.assertEqual(self.session.write(path, payload)["written"], len(payload))
                        self.assertEqual(path.read_bytes(), bom + b"new\rcontent" + eol + b"next" + (eol if final else b""))
                        self.assertNotIn(str(path), self.session.shown)
                        self.refuses(path, [replace(old, "old-authority")])
                        self.assertIn(str(other), self.session.shown)
        new = self.root / "new"
        payload = "\ufeffnew\r\n界"
        self.assertEqual(self.session.write(new, payload)["written"], len(payload))
        self.assertEqual(new.read_bytes(), payload.encode())

    def test_write_same_bytes_requires_new_display_but_refs_remain_deterministic(self):
        path = self.file()
        old = self.rows(path)[0]["ref"]
        content = path.read_text()
        self.session.write(path, content)
        self.refuses(path, [replace(old, "old")])
        self.assertEqual(self.rows(path)[0]["ref"], old)
        self.session.edit(path, [replace(old, "allowed-after-read")])

    def test_file_permissions_ownership_and_adjacent_temporary_cleanup(self):
        path = self.file()
        path.chmod(0o640)
        before = path.stat()
        row = self.rows(path)[0]
        self.session.edit(path, [replace(row["ref"], "changed")])
        edited = path.stat()
        self.assertEqual(stat.S_IMODE(edited.st_mode), 0o640)
        self.assertEqual((edited.st_uid, edited.st_gid), (before.st_uid, before.st_gid))
        self.session.write(path, "written\n")
        written = path.stat()
        self.assertEqual(stat.S_IMODE(written.st_mode), 0o640)
        self.assertEqual((written.st_uid, written.st_gid), (before.st_uid, before.st_gid))
        self.assertEqual({entry.name for entry in self.root.iterdir()}, {path.name})

    def test_grep_supplied_hits_context_duplicates_and_long_preview_edit(self):
        long = "needle " + "界" * 3000
        path = self.file("before\n" + long + "\nafter\n")
        result = self.session.grep([
            {"path": path, "number": 1, "text": "before", "match": False},
            {"path": path, "number": 2, "text": long, "match": False},
            {"path": path, "number": 2, "text": long, "match": True},
            {"path": path, "number": 3, "text": "after", "match": False},
        ])
        self.assertEqual(result["matches"], 1)
        self.assertTrue(result["truncated"])
        rows = result["files"][0]["lines"]
        self.assertEqual([row["number"] for row in rows], [1, 2, 3])
        self.assertEqual(rows[1]["text"], long[:2000])
        self.assertEqual(rows[1]["omitted_chars"], len(long) - 2000)
        self.assertEqual(rows[1]["ref"], reference(path, 2, long))
        self.assertIn(">" + rows[1]["ref"] + "│", str(result))
        self.session.edit(path, [replace(rows[0]["ref"], "context"), replace(rows[1]["ref"], "short")])
        self.assertEqual(path.read_bytes(), b"context\nshort\nafter\n")

    def test_grep_budget_counts_headers_and_registers_only_returned_rows(self):
        hits = []
        for number in range(1, 101):
            path = self.root / (f"{number:03}-" + "h" * 180)
            text = "needle " + "界" * 1990
            path.write_text(text + "\n")
            hits.append({"path": path, "number": 1, "text": text, "match": True})
        result = self.session.grep(hits)
        self.assertTrue(result["output_limited"])
        self.assertTrue(result["truncated"])
        self.assertLess(result["matches"], 100)
        self.assertGreater(result["matches"], 0)
        self.assertLessEqual(len(str(result).encode()), 50 * 1024)
        returned = {group["path"] for group in result["files"]}
        self.assertEqual(set(self.session.shown), returned)
        empty = self.session.grep([])
        self.assertEqual(empty["files"], [])
        self.assertEqual(empty["matches"], 0)
        self.assertFalse(empty["truncated"])

    def test_grep_does_not_authorize_unreturned_or_inconsistent_hits(self):
        path = self.file()
        result = self.session.grep([{"path": path, "number": 2, "text": "beta", "match": True}])
        self.assertEqual(set(self.session.shown[str(path)]), {2})
        self.refuses(path, [replace(reference(path, 1, "alpha"), "unreturned")])
        fresh = Session()
        with self.assertRaises(ValueError):
            fresh.grep([{"path": path, "number": 1, "text": "a", "match": True},
                        {"path": path, "number": 1, "text": "b", "match": True}])
        self.assertEqual(fresh.shown, {})
        self.assertEqual(result["files"][0]["lines"][0]["ref"], reference(path, 2, "beta"))

    def test_post_hook_disk_refresh_preserves_unchanged_refs_and_authorizes_actual_rows(self):
        path = self.file("".join(f"row-{number}\n" for number in range(1, 13)))
        def format_after_native(name, args):
            outcome = execute_file(name, args)
            if name == "edit" and "unformatted" in path.read_text():
                path.write_text(path.read_text().replace("unformatted", "formatted"))
            return outcome
        session = HashlineSession(execute=format_after_native)
        rows = session.read(path)["lines"]
        result = session.edit(path, [replace(rows[0]["ref"], "unformatted")])
        self.assertTrue(result["formatted"])
        actual = next(row for row in result["diff"] if row["kind"] == "+")
        self.assertEqual(actual["text"], "formatted")
        self.assertEqual(actual["ref"], reference(path, 1, "formatted"))
        self.assertEqual(session.shown[str(path)][12], full_hash(path, "row-12"))
        session.edit(path, [replace(actual["ref"], "next"), replace(rows[-1]["ref"], "tail")])
        self.assertEqual(path.read_text(), "next\n" + "".join(f"row-{number}\n" for number in range(2, 12)) + "tail\n")

    def test_invalid_configuration_bounds_and_text(self):
        for options in ({"align_window": 0}, {"align_window": True}, {"max_edit_bytes": -1}):
            with self.subTest(options=options), self.assertRaises(ValueError):
                Session(**options)
        path = self.file()
        for options in ({"offset": "1#aaa"}, {"offset": True}, {"limit": 0}, {"limit": 1.2}):
            with self.subTest(options=options), self.assertRaises(ValueError):
                self.session.read(path, **options)
        for text in (b"bytes", "\0", "\ud800"):
            before = path.read_bytes()
            with self.assertRaises(ValueError):
                self.session.write(path, text)
            self.assertEqual(path.read_bytes(), before)
        for hit in ({}, {"path": path, "number": True, "text": "x", "match": True},
                    {"path": path, "number": 1, "text": "x\ny", "match": True},
                    {"path": path, "number": 1, "text": "x", "match": 1}):
            with self.subTest(hit=hit), self.assertRaises(ValueError):
                self.session.grep([hit])


    def swap(self, path, pid, host=None, suffix="swp", valid=True):
        # Public Vim v9.1.0000 memline.c struct block0 + long_to_char:
        # https://github.com/vim/vim/blob/v9.1.0000/src/memline.c
        header = bytearray(108)
        header[:12] = b"b0VIM 9.1\0\0\0"
        header[24:28] = pid.to_bytes(4, "little")
        host = (host or socket.gethostname()).encode()[:39]
        header[68:68 + len(host)] = host
        if not valid:
            header[:2] = b"xx"
        basename = path.name if path.name.startswith(".") else "." + path.name
        swap = path.with_name(basename + "." + suffix)
        swap.write_bytes(header)
        return swap

    def test_live_vim_pid_rejects_edit_write_for_all_adjacent_suffix_families(self):
        path = self.file()
        row = self.rows(path)[0]
        process = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"])
        try:
            for suffix in ("swp", "swo", "swa", "svz", "saa"):
                with self.subTest(suffix=suffix):
                    swap = self.swap(path, process.pid, suffix=suffix)
                    try:
                        error = self.refuses(path, [replace(row["ref"], "blocked")])
                        self.assertIn("vim", str(error))
                        before = path.read_bytes()
                        with self.assertRaises(HashlineError) as caught:
                            self.session.write(path, "blocked\n")
                        self.assertIn("vim", str(caught.exception))
                        self.assertEqual(path.read_bytes(), before)
                    finally:
                        swap.unlink()
        finally:
            process.terminate()
            process.wait(timeout=5)

    def test_vim_hidden_basename_uses_one_leading_dot(self):
        path = self.file(name=".hidden")
        row = self.rows(path)[0]
        swap = self.swap(path, os.getpid())
        self.assertEqual(swap.name, ".hidden.swp")
        self.assertIn("vim", str(self.refuses(path, [replace(row["ref"], "blocked")])))
        with self.assertRaises(HashlineError):
            self.session.write(path, "blocked")

    def test_dead_foreign_unparseable_vim_swaps_do_not_block(self):
        path = self.file()
        dead = subprocess.Popen([sys.executable, "-c", "pass"])
        dead.wait(timeout=5)
        for options in ({"pid": dead.pid}, {"pid": os.getpid(), "host": "not-this-machine.invalid"},
                        {"pid": os.getpid(), "valid": False}, {"pid": 0},
                        {"pid": os.getpid(), "suffix": "swz"}):
            with self.subTest(options=options):
                swap = self.swap(path, **options)
                try:
                    ref = self.rows(path)[0]["ref"]
                    self.session.edit(path, [replace(ref, "allowed")])
                    self.session.write(path, "allowed\n")
                finally:
                    swap.unlink()
        broken = path.with_name("." + path.name + ".swp")
        broken.write_bytes(b"unreadable pid")
        self.session.write(path, "still-allowed\n")
        self.assertEqual(path.read_bytes(), b"still-allowed\n")

    def test_emacs_local_live_pid_blocks_and_dead_foreign_malformed_do_not(self):
        path = self.file()
        lock = path.with_name(".#" + path.name)
        process = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"])
        try:
            lock.symlink_to(f"user@{socket.gethostname()}.{process.pid}:123456")
            row = self.rows(path)[0]
            error = self.refuses(path, [replace(row["ref"], "blocked")])
            self.assertIn("emacs", str(error))
            before = path.read_bytes()
            with self.assertRaises(HashlineError) as caught:
                self.session.write(path, "blocked\n")
            self.assertIn("emacs", str(caught.exception))
            self.assertEqual(path.read_bytes(), before)
            lock.unlink()
            process.terminate()
            process.wait(timeout=5)
            for owner in (f"user@{socket.gethostname()}.{process.pid}:123456", f"user@elsewhere.invalid.{os.getpid()}:1", "malformed"):
                lock.symlink_to(owner)
                try:
                    self.session.write(path, "allowed\n")
                finally:
                    lock.unlink()
            lock.write_text(f"user@{socket.gethostname()}.{os.getpid()}:1")
            self.session.write(path, "regular-file-is-not-emacs-lock\n")
            self.assertEqual(path.read_bytes(), b"regular-file-is-not-emacs-lock\n")
        finally:
            if process.poll() is None:
                process.terminate()
                process.wait(timeout=5)


if __name__ == "__main__":
    unittest.main()

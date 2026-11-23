from pathlib import Path
import hashlib
import json
import os
import re
import stat
import time


def expected_ref(path, number, text):
    digest = hashlib.blake2b((str(Path(path).resolve()) + "\0" + text).encode()).hexdigest()
    return f"{number}#{digest[:3]}"


def moved(ref, number):
    return f"{number}#{ref.split('#')[1]}"


def check_read(result, path, total=None):
    assert result["path"] == str(Path(path).resolve()), result
    assert result["total_lines"] is None or isinstance(result["total_lines"], int) and result["total_lines"] >= 1, result
    if total is not None and result["total_lines"] is not None:
        assert result["total_lines"] == total, result
    assert isinstance(result["truncated"], bool), result
    assert result["next_offset"] is None or type(result["next_offset"]) is int, result
    assert result["next_offset"] is not None or result["total_lines"] is not None, "EOF must report the known total"
    assert 0 < len(result["lines"]) <= 2000, result
    for row in result["lines"]:
        assert isinstance(row["number"], int) and row["number"] >= 1, row
        if result["total_lines"] is not None:
            assert row["number"] <= result["total_lines"], row
        assert re.fullmatch(rf"{row['number']}#[0-9a-f]{{3}}", row["ref"]), row
        assert isinstance(row["omitted"], bool), row
        assert row["text"] is None if row["omitted"] else isinstance(row["text"], str), row
        if row["text"] is not None:
            assert "\n" not in row["text"], row
            assert row["ref"] == expected_ref(path, row["number"], row["text"]), row
    assert len(str(result).encode("utf-8")) <= 50 * 1024, "read rendering exceeds byte cap"
    assert len(repr(result).encode("utf-8")) <= 50 * 1024, "interactive read rendering exceeds byte cap"
    assert all(row["ref"] in str(result) for row in result["lines"]), result
    return result


def check_diff(result, path):
    assert result["path"] == str(Path(path).resolve()), result
    assert isinstance(result["truncated"], bool), result
    assert len(result["diff"]) <= 2000, result
    for row in result["diff"]:
        assert row["kind"] in ("+", "-", " "), row
        assert isinstance(row["number"], int) and row["number"] >= 1, row
        assert re.fullmatch(rf"{row['number']}#[0-9a-f]{{3}}", row["ref"]), row
        assert isinstance(row["omitted"], bool), row
        assert row["text"] is None if row["omitted"] else isinstance(row["text"], str), row
        if row["text"] is not None:
            assert row["ref"] == expected_ref(path, row["number"], row["text"]), row
    assert len(str(result).encode("utf-8")) <= 50 * 1024, "diff rendering exceeds byte cap"
    assert len(repr(result).encode("utf-8")) <= 50 * 1024, "interactive diff rendering exceeds byte cap"
    assert all(row["ref"] in str(result) for row in result["diff"]), result
    return result


def replace(ref, text, end=None):
    return {"op": "replace", "start": ref, "end": ref if end is None else end, "text": text}


def insert(ref, text, where="after"):
    return {"op": "insert", "ref": ref, "where": where, "text": text}


def added(result, text):
    matches = [row for row in result["diff"] if row["kind"] == "+" and row["text"] == text]
    assert len(matches) == 1, result
    return matches[0]["ref"]


def refuse(path, operations, fresh_text=None):
    before = Path(path).read_bytes()
    try:
        edit(path, operations)
    except ValueError as error:
        assert Path(path).read_bytes() == before, "refused edit changed file bytes"
        if fresh_text is not None:
            context = check_read(error.context, path)
            assert any(row["text"] == fresh_text for row in context["lines"]), context
            assert any(row["ref"] in str(error) for row in context["lines"]), str(error)
        return error
    raise AssertionError("edit accepted invalid, stale, overlapping, or unread refs")


# Pick a path whose 12-bit suffixes distinguish the stale-ref examples; collisions are valid.
for candidate in range(100):
    basic_path = Path(f"hashedit-basic-{candidate}.txt")
    if len({expected_ref(basic_path, 2, text) for text in ("insert-1", "BETA", "BETA-3")}) == 3 and expected_ref(basic_path, 3, "gamma") != expected_ref(basic_path, 3, "insert-2"):
        break
else:
    raise AssertionError("could not select distinct stale-ref example suffixes")
assert write(basic_path, "alpha\nbeta\ngamma\n")["written"] == 17
basic = check_read(read(basic_path), basic_path, 3)
assert [row["text"] for row in basic["lines"]] == ["alpha", "beta", "gamma"], basic
basic_ref = basic["lines"][1]["ref"]
basic_diff = check_diff(edit(basic_path, [replace(basic_ref, "BETA")]), basic_path)
assert basic_path.read_bytes() == b"alpha\nBETA\ngamma\n"
assert any(row["kind"] == "+" and row["text"] == "BETA" for row in basic_diff["diff"]), basic_diff
print("HASHEDIT_BASIC_OK")

# Results are mappings for Python and ref renderings for print / interactive use.
for rendered in (str(basic), repr(basic)):
    assert f"{basic['lines'][0]['ref']}│alpha" in rendered, rendered
assert basic["next_offset"] is None and not basic["truncated"] and basic["total_lines"] == 3, basic
assert basic_diff["truncated"] is False, basic_diff
assert any(row["kind"] == "-" and row["ref"] == basic_ref for row in basic_diff["diff"]), basic_diff
stable_left, stable_right = basic["lines"][0]["ref"], basic["lines"][2]["ref"]
first_added = added(basic_diff, "BETA")
assert first_added == expected_ref(basic_path, 2, "BETA")

# No read between calls: diff new/context refs and translated suffixes authorize the next edit.
chained = check_diff(edit(basic_path, [replace(first_added, "BETA-2")]), basic_path)
second_added = added(chained, "BETA-2")
assert second_added == expected_ref(basic_path, 2, "BETA-2")
contexts = [row for row in chained["diff"] if row["kind"] == " "]
assert any(row["ref"] in (stable_left, stable_right) for row in contexts), chained
context_row = next(row for row in contexts if row["ref"] in (stable_left, stable_right))
edit(basic_path, [replace(context_row["ref"], context_row["text"])])
inserted = check_diff(edit(basic_path, [insert(stable_left, "insert-1\ninsert-2\n")]), basic_path)
insert_one, insert_two = added(inserted, "insert-1"), added(inserted, "insert-2")
assert basic_path.read_bytes() == b"alpha\ninsert-1\ninsert-2\nBETA-2\ngamma\n"
refuse(basic_path, [replace(stable_right, "must not follow an old coordinate")])
translated_second, translated_right = moved(second_added, 4), moved(stable_right, 5)
translated = check_diff(edit(basic_path, [replace(translated_second, "BETA-3"), replace(translated_right, "GAMMA")]), basic_path)
third_added, changed_right = added(translated, "BETA-3"), added(translated, "GAMMA")
assert basic_path.read_bytes() == b"alpha\ninsert-1\ninsert-2\nBETA-3\nGAMMA\n"
after_insert = check_read(read(basic_path), basic_path, 5)
assert after_insert["lines"][0]["ref"] == stable_left
assert after_insert["lines"][3]["ref"] == third_added and after_insert["lines"][4]["ref"] == changed_right
deleted = check_diff(edit(basic_path, [replace(insert_one, "", insert_two)]), basic_path)
assert {row["ref"] for row in deleted["diff"] if row["kind"] == "-"} == {insert_one, insert_two}, deleted
assert basic_path.read_bytes() == b"alpha\nBETA-3\nGAMMA\n"
refuse(basic_path, [replace(insert_one, "expired")])
refuse(basic_path, [replace(first_added, "expired")])
no_op = edit(basic_path, [replace(stable_left, "alpha")])
check_diff(no_op, basic_path)
assert [row["ref"] for row in read(basic_path)["lines"]] == [stable_left, moved(third_added, 2), moved(changed_right, 3)]

# Deterministic coordinates replace allocation/non-reuse: restoring text restores its ref.
current = moved(third_added, 2)
for text_value in ["cycle-0", "cycle-1", "cycle-2", "beta", "BETA", "BETA-2"]:
    current = added(edit(basic_path, [replace(current, text_value)]), text_value)
    assert current == expected_ref(basic_path, 2, text_value)
    current_rows = read(basic_path)["lines"]
    assert current_rows[0]["ref"] == stable_left and current_rows[-1]["ref"] == moved(changed_right, 3)
assert current == second_added

duplicates = Path("hashedit-duplicates.txt")
write(duplicates, "same\nsame\nsame\nsame\n")
duplicate_read = check_read(read(duplicates), duplicates, 4)
assert len({row["ref"] for row in duplicate_read["lines"]}) == 4
assert len({row["ref"].split("#")[1] for row in duplicate_read["lines"]}) == 1
duplicate_ref = duplicate_read["lines"][1]["ref"]
edit(duplicates, [replace(duplicate_ref, "different")])
duplicate_after = read(duplicates)["lines"]
assert [row["ref"] for row in duplicate_after][::2] == [duplicate_read["lines"][0]["ref"], duplicate_read["lines"][2]["ref"]]
assert duplicate_after[3]["ref"] == duplicate_read["lines"][3]["ref"]

# Pagination takes integer coordinates, reports unknown totals until EOF, and serves only its page.
paged = Path("hashedit-pagination.txt")
write(paged, "\n".join(f"row-{number:04d}" for number in range(1, 2206)) + "\n")
page = check_read(read(paged), paged)
assert len(page["lines"]) == 2000 and page["truncated"] and page["next_offset"] == 2001, page
assert page["total_lines"] is None, page
refuse(paged, [replace(expected_ref(paged, 2001, "row-2001"), "not-yet-served")])
continuation = check_read(read(paged, offset=page["next_offset"], limit=2), paged)
assert [(row["number"], row["text"]) for row in continuation["lines"]] == [(2001, "row-2001"), (2002, "row-2002")]
number_page = check_read(read(paged, offset=17, limit=2), paged)
assert [(row["number"], row["text"]) for row in number_page["lines"]] == [(17, "row-0017"), (18, "row-0018")]
assert number_page["lines"][0]["ref"] == page["lines"][16]["ref"]
last_page = read(paged, offset=2205)
assert last_page["next_offset"] is None and last_page["total_lines"] == 2205
try:
    read(paged, offset=page["lines"][0]["ref"])
except ValueError:
    pass
else:
    raise AssertionError("read accepted removed ref offset API")

byte_capped = Path("hashedit-byte-cap.txt")
write(byte_capped, "\n".join("界" * 60 + str(number) for number in range(800)) + "\n")
byte_page = check_read(read(byte_capped), byte_capped)
assert byte_page["truncated"] and byte_page["next_offset"] and len(byte_page["lines"]) < 800
assert not any(row["omitted"] for row in byte_page["lines"]), "ordinary rows were hidden instead of paginated"
byte_next = check_read(read(byte_capped, offset=byte_page["next_offset"], limit=1), byte_capped)
assert byte_next["lines"][0]["number"] == byte_page["lines"][-1]["number"] + 1

# Served endpoints do not authorize an unread range interior.
unread_path = Path("hashedit-unread.txt")
write(unread_path, "start\nunread-middle\nend\n")
unread_first = read(unread_path, limit=1)["lines"][0]["ref"]
unread_last = read(unread_path, offset=3, limit=1)["lines"][0]["ref"]
refuse(unread_path, [replace(unread_first, "must-not-write", unread_last)])

# A batch is resolved against one pre-call state, regardless of operation order.
for candidate in range(100):
    batch_path = Path(f"hashedit-batch-{candidate}.txt")
    if expected_ref(batch_path, 3, "c") != expected_ref(batch_path, 3, "b"):
        break
else:
    raise AssertionError("could not select distinct batch stale-ref suffixes")
write(batch_path, "a\nb\nc\nd\ne\nf\n")
batch_rows = read(batch_path)["lines"]
refs = [row["ref"] for row in batch_rows]
batch = check_diff(edit(batch_path, [replace(refs[4], "E"), insert(refs[1], "before-b", "before"), replace(refs[2], "CD", refs[3])]), batch_path)
assert batch_path.read_bytes() == b"a\nbefore-b\nb\nCD\nE\nf\n"
batch_after = read(batch_path)["lines"]
assert [batch_after[index]["ref"] for index in (0, 2, 5)] == [refs[0], moved(refs[1], 3), refs[5]]
assert all(added(batch, text) == expected_ref(batch_path, number, text) for number, text in ((5, "E"), (2, "before-b"), (4, "CD")))
fresh = [row["ref"] for row in batch_after]
refuse(batch_path, [replace(fresh[0], "valid-but-not-committed"), {"op": "unknown", "ref": fresh[5], "text": "invalid"}])
refuse(batch_path, [replace(fresh[0], "valid-but-not-committed"), replace(refs[2], "expired")])
refuse(batch_path, [replace(fresh[0], "x", fresh[3]), replace(fresh[2], "y", fresh[4])])
refuse(batch_path, [replace(fresh[1], "x", fresh[4]), insert(fresh[2], "overlapping-interior-gap")])
refuse(batch_path, [insert(fresh[2], "x"), insert(fresh[2], "y")])
refuse(batch_path, [replace(fresh[4], "reversed", fresh[1])])
refuse(batch_path, [replace(1, "numeric addressing is not supported")])
refuse(batch_path, [])

# Unrelated external changes do not invalidate unchanged coordinates.
external_path = Path("hashedit-external-single.txt")
external_original = [f"external-{number}" for number in range(7)]
write(external_path, "\n".join(external_original) + "\n")
external_before = read(external_path)["lines"]
external_changed = external_original.copy()
external_changed[5] = "externally-replaced"
external_path.write_text("\n".join(external_changed) + "\n", encoding="utf-8")
edit(external_path, [replace(external_before[1]["ref"], "our-change")])
external_after = read(external_path)["lines"]
assert [row["text"] for row in external_after] == [external_changed[0], "our-change", *external_changed[2:]]
for index in (0, 2, 3, 4, 6):
    assert external_after[index]["ref"] == external_before[index]["ref"]
assert external_after[5]["ref"] == expected_ref(external_path, 6, "externally-replaced")

# Unique shown windows align across external top insertions and deletions.
for change in ("insert", "delete"):
    shifted_path = Path(f"hashedit-external-shift-{change}.txt")
    shifted_original = [f"shift-{number:03d}" for number in range(302)]
    write(shifted_path, "\n".join(shifted_original) + "\n")
    shifted_before = read(shifted_path)["lines"]
    external = ["external-top", *shifted_original] if change == "insert" else shifted_original[1:]
    delta = 1 if change == "insert" else -1
    shifted_path.write_text("\n".join(external) + "\n", encoding="utf-8")
    edit(shifted_path, [replace(shifted_before[150]["ref"], "our-middle-change")])
    shifted_after = check_read(read(shifted_path), shifted_path, len(external))["lines"]
    assert shifted_after[150 + delta]["text"] == "our-middle-change"
    for index in range(1 if change == "delete" else 0, len(shifted_original)):
        if index != 150:
            assert shifted_after[index + delta]["ref"] == moved(shifted_before[index]["ref"], index + delta + 1), index

# Exercise 300-row alignment with an actually moved unique boundary in the batch.
repeated_path = Path("hashedit-external-repetitive-shift.txt")
repeated_original = ["first"] + ["repeated-middle"] * 300 + ["bottom"]
write(repeated_path, "\n".join(repeated_original) + "\n")
repeated_before = read(repeated_path)["lines"]
repeated_path.write_text("\n".join(["external-top", *repeated_original[:-1], "external-bottom"]) + "\n", encoding="utf-8")
edit(repeated_path, [replace(repeated_before[0]["ref"], "first"), replace(repeated_before[150]["ref"], "our-middle-change")])
repeated_after = check_read(read(repeated_path), repeated_path, 303)["lines"]
assert repeated_after[0]["text"] == "external-top" and repeated_after[-1]["text"] == "external-bottom"
for index in range(301):
    if index != 150:
        assert repeated_after[index + 1]["ref"] == moved(repeated_before[index]["ref"], index + 2), index
assert repeated_after[151]["text"] == "our-middle-change"
assert repeated_after[-1]["ref"] == expected_ref(repeated_path, 303, "external-bottom")

# Changed endpoints and interiors refuse atomically and return immediately editable context.
stale_path = Path("hashedit-stale-endpoint.txt")
write(stale_path, "left\nold-target\nright\n")
stale_before = read(stale_path)["lines"]
stale_path.write_bytes(b"left\nexternal-target\nright\n")
stale_error = refuse(stale_path, [replace(stale_before[0]["ref"], "must-not-write"), replace(stale_before[1]["ref"], "must-not-write")], "external-target")
fresh_target = next(row["ref"] for row in stale_error.context["lines"] if row["text"] == "external-target")
assert fresh_target == expected_ref(stale_path, 2, "external-target")
edit(stale_path, [replace(fresh_target, "context-ref-worked")])
assert stale_path.read_bytes() == b"left\ncontext-ref-worked\nright\n"

interior_path = Path("hashedit-stale-interior.txt")
write(interior_path, "range-start\nold-interior\nrange-end\n")
interior_before = read(interior_path)["lines"]
interior_path.write_bytes(b"range-start\nexternal-interior\nrange-end\n")
refuse(interior_path, [replace(interior_before[0]["ref"], "must-not-write", interior_before[2]["ref"])], "external-interior")
edit(interior_path, [replace(interior_before[0]["ref"], "unchanged-endpoint-still-works")])
assert interior_path.read_bytes() == b"unchanged-endpoint-still-works\nexternal-interior\nrange-end\n"

far_path = Path("hashedit-far-interior.txt")
far_lines = [f"far-{number}" for number in range(15)]
write(far_path, "\n".join(far_lines) + "\n")
far_before = read(far_path)["lines"]
far_lines[10] = "far-external-change"
far_path.write_text("\n".join(far_lines) + "\n", encoding="utf-8")
refuse(far_path, [replace(far_before[0]["ref"], "must-not-write", far_before[-1]["ref"])], "far-external-change")

for external_text, context_text in (("start\ninserted\nmiddle\nend\n", "inserted"), ("start\nend\n", "end")):
    write(interior_path, "start\nmiddle\nend\n")
    interior_before = read(interior_path)["lines"]
    interior_path.write_text(external_text, encoding="utf-8")
    refuse(interior_path, [replace(interior_before[0]["ref"], "must-not-write", interior_before[-1]["ref"])], context_text)

# BOM, newline style, EOF state, mode and ownership survive normalized payload breaks.
for bom in (b"", b"\xef\xbb\xbf"):
    for eol in (b"\n", b"\r\n"):
        for final_newline in (False, True):
            style_path = Path(f"hashedit-style-{len(bom)}-{len(eol)}-{int(final_newline)}.txt")
            suffix = eol if final_newline else b""
            style_path.write_bytes(bom + eol.join((b"left", b"middle", b"right")) + suffix)
            style_path.chmod(0o640)
            metadata = style_path.stat()
            style_before = check_read(read(style_path), style_path, 3)
            assert [row["text"] for row in style_before["lines"]] == ["left", "middle", "right"]
            edit(style_path, [replace(style_before["lines"][1]["ref"], "new\nrows\n"), insert(style_before["lines"][2]["ref"], "tail\r\n")])
            assert style_path.read_bytes() == bom + eol.join((b"left", b"new", b"rows", b"right", b"tail")) + suffix
            current_metadata = style_path.stat()
            assert stat.S_IMODE(current_metadata.st_mode) == 0o640
            assert (current_metadata.st_uid, current_metadata.st_gid) == (metadata.st_uid, metadata.st_gid)
            style_after = read(style_path)["lines"]
            assert style_after[0]["ref"] == style_before["lines"][0]["ref"]
            assert style_after[3]["ref"] == moved(style_before["lines"][2]["ref"], 4)
            # Whole-file write preserves existing BOM/style, but takes EOF state from its payload.
            payload = "whole\nfile" + ("" if final_newline else "\n")
            assert write(style_path, payload)["written"] == len(payload)
            assert style_path.read_bytes() == bom + eol.join((b"whole", b"file")) + (b"" if final_newline else eol)
            assert stat.S_IMODE(style_path.stat().st_mode) == 0o640
            assert (style_path.stat().st_uid, style_path.stat().st_gid) == (metadata.st_uid, metadata.st_gid)

# A logical terminal blank may add EOF LF; a single payload terminator is not a blank row.
for final_newline in (False, True):
    suffix = b"\n" if final_newline else b""
    for payload, expected, eof_added in ((None, b"first\nlast\n" + suffix, [(3, "")]),
                                       ("x\n", b"first\nx" + suffix, [(2, "x")]),
                                       ("x\n\n", b"first\nx\n" + suffix, [(2, "x"), (3, "")])):
        eof_path = Path("hashedit-terminal-blank.txt")
        eof_path.write_bytes(b"first\nlast" + suffix)
        eof_ref = read(eof_path)["lines"][-1]["ref"]
        operation = insert(eof_ref, "") if payload is None else replace(eof_ref, payload)
        result = check_diff(edit(eof_path, [operation]), eof_path)
        assert eof_path.read_bytes() == expected
        assert [(row["number"], row["text"]) for row in result["diff"] if row["kind"] == "+"] == eof_added

cr_path = Path("hashedit-bare-cr.txt")
cr_path.write_bytes(b"left\rmiddle\nright\r")
cr_rows = check_read(read(cr_path), cr_path, 2)["lines"]
assert [row["text"] for row in cr_rows] == ["left\rmiddle", "right\r"]
edit(cr_path, [replace(cr_rows[0]["ref"], "changed\rcontent")])
assert cr_path.read_bytes() == b"changed\rcontent\nright\r"

hidden_path = Path("hashedit-hidden-line.txt")
hidden_text = "界" * 20000
hidden_path.write_text("left\n" + hidden_text + "\nright\n", encoding="utf-8")
hidden = check_read(read(hidden_path), hidden_path, 3)
hidden_row = next(row for row in hidden["lines"] if row["number"] == 2)
assert hidden_row["omitted"] and hidden_row["text"] is None
assert hidden_row["bytes"] == len(hidden_text.encode("utf-8")), hidden_row
assert hidden_text not in str(hidden) and hidden_row["ref"] in str(hidden)
check_diff(edit(hidden_path, [replace(hidden_row["ref"], "short")]), hidden_path)
assert hidden_path.read_bytes() == b"left\nshort\nright\n"

for name, data in (("nul", b"left\x00right"), ("utf16le", b"\xff\xfeh\x00i\x00"), ("utf16be", b"\xfe\xff\x00h\x00i"), ("utf32le", b"\xff\xfe\x00\x00h\x00\x00\x00"), ("utf32be", b"\x00\x00\xfe\xff\x00\x00\x00h")):
    binary_path = Path(f"hashedit-refuse-{name}.txt")
    binary_path.write_bytes(data)
    try:
        read(binary_path)
    except ValueError:
        pass
    else:
        raise AssertionError(f"read accepted unsupported {name} bytes")
    assert binary_path.read_bytes() == data

# Empty files have one editable empty row; deleting all text restores its deterministic ref.
empty_path = Path("hashedit-empty.txt")
empty_path.write_bytes(b"")
empty = check_read(read(empty_path), empty_path, 1)
assert empty["lines"][0]["text"] == "" and not empty["lines"][0]["omitted"]
empty_ref = empty["lines"][0]["ref"]
empty_added = added(edit(empty_path, [replace(empty_ref, "first")]), "first")
assert empty_path.read_bytes() == b"first"
empty_deleted = check_diff(edit(empty_path, [replace(empty_added, "")]), empty_path)
assert empty_path.read_bytes() == b""
new_empty_ref = added(empty_deleted, "")
assert new_empty_ref == empty_ref
edit(empty_path, [replace(new_empty_ref, "restored")])
assert empty_path.read_bytes() == b"restored"
blank_insert = edit(empty_path, [insert(read(empty_path)["lines"][0]["ref"], "", "before")])
assert empty_path.read_bytes() == b"\nrestored"
assert added(blank_insert, "")

# Realpath aliases share authority; write clears it, but reread reauthorizes identical refs.
alias_path = Path("hashedit-realpath.txt")
alias_link = Path("hashedit-realpath-link.txt")
alias_path.write_bytes(b"left\nright\n")
alias_path.chmod(0o640)
alias_metadata = alias_path.stat()
alias_link.symlink_to(alias_path.name)
alias_original = check_read(read(alias_path), alias_path, 2)
alias_rows = check_read(read(alias_link), alias_path, 2)["lines"]
assert alias_rows == alias_original["lines"]
assert read(str(alias_path.resolve()))["lines"] == alias_rows
alias_result = edit(alias_link, [replace(alias_rows[1]["ref"], "edited-via-link")])
assert alias_result["path"] == str(alias_path.resolve())
assert alias_path.read_bytes() == b"left\nedited-via-link\n" and alias_link.is_symlink()
alias_before_write = read(alias_path)["lines"]
same_content = alias_path.read_text(encoding="utf-8")
assert write(alias_link, same_content)["written"] == len(same_content)
assert stat.S_IMODE(alias_path.stat().st_mode) == 0o640
assert (alias_path.stat().st_uid, alias_path.stat().st_gid) == (alias_metadata.st_uid, alias_metadata.st_gid)
refuse(alias_path, [replace(alias_before_write[0]["ref"], "must-not-write")])
assert write(alias_link, same_content)["written"] == len(same_content)
refuse(alias_link, [replace(alias_before_write[1]["ref"], "must-not-write")])
alias_after_write = read(alias_path)["lines"]
assert alias_after_write == alias_before_write
edit(alias_link, [replace(alias_before_write[1]["ref"], "reread-authorized")])
assert alias_path.read_bytes() == b"left\nreread-authorized\n"
assert write(alias_path, "界\n")["written"] == 2
assert alias_path.read_bytes() == "界\n".encode("utf-8")
refuse(alias_link, [replace(alias_after_write[0]["ref"], "must-not-write")])

# Large diff output is capped; serve all old pages before replacing the full range.
large_tail = read(paged, offset=2001)
large_diff = check_diff(edit(paged, [replace(page["lines"][0]["ref"], "\n".join(f"new-{number:04d}" for number in range(1, 2206)), large_tail["lines"][-1]["ref"])]), paged)
assert large_diff["truncated"], "large diff must advertise omitted rows"
assert paged.read_bytes().startswith(b"new-0001\n") and paged.read_bytes().endswith(b"new-2205\n")
large_live = next(row for row in large_diff["diff"] if row["kind"] == "+")
edit(paged, [replace(large_live["ref"], "large-diff-chain")])
assert paged.read_bytes().startswith(b"large-diff-chain\n")

# Measure real public edit calls on 10k lines, without timing thresholds or private state inspection.
perf_path = Path("hashedit-perf.txt")
perf_lines = [f"performance-line-{number:05d}" for number in range(10000)]
write(perf_path, "\n".join(perf_lines) + "\n")
perf_first = read(perf_path, limit=1)["lines"][0]["ref"]
perf_middle = read(perf_path, offset=5001, limit=1)["lines"][0]["ref"]
started = time.perf_counter()
perf_fast = edit(perf_path, [replace(perf_middle, "fast-path-change")])
fast_edit_ms = (time.perf_counter() - started) * 1000
assert added(perf_fast, "fast-path-change")
assert perf_path.read_bytes().splitlines()[5000] == b"fast-path-change"
perf_lines[5000] = "fast-path-change"
perf_lines[-1] = "external-slow-path-change"
perf_path.write_text("\n".join(perf_lines) + "\n", encoding="utf-8")
started = time.perf_counter()
perf_slow = edit(perf_path, [replace(perf_first, "our-slow-path-change")])
external_change_edit_ms = (time.perf_counter() - started) * 1000
assert added(perf_slow, "our-slow-path-change")
assert perf_path.read_bytes().splitlines()[0] == b"our-slow-path-change"
assert perf_path.read_bytes().splitlines()[-1] == b"external-slow-path-change"
print("HASHEDIT_PERF " + json.dumps({"lines": 10000, "fast_edit_ms": fast_edit_ms, "external_change_edit_ms": external_change_edit_ms}))

# Persist public data for the JS runner's real reset:true and reread acceptance.
restart_path = Path("hashedit-restart.txt")
write(restart_path, "before-restart\n")
restart_ref = read(restart_path)["lines"][0]["ref"]
Path("hashedit-restart.json").write_text(json.dumps({"path": str(restart_path.resolve()), "ref": restart_ref, "pid": os.getpid()}), encoding="utf-8")
print("HASHEDIT_SCENARIOS_OK")

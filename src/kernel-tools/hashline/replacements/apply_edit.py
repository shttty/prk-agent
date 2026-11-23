import hashlib
from .assemble_edit import assemble_edit
from ..call_file_tool import _call
from ..display.render_diff import _diff
from ..assemble_error import HashlineError
from ..references.resolve_path import _path
from ..references.hash_current_line import current_hash
from ..content.load_edit_file import _load
from ..content.strip_line_ending import _logical
from ..content.split_lines import _split
from ..alignment.align_references import align_references
from ..alignment.align_sequences import _opcodes
from .reject_edit import refuse


def _edit(ctx, path, parsed):
    previous = ctx.shown.get(path)
    if not previous:
        raise HashlineError("No displayed references for this file; read it first")
    data, bom, lines, metadata = _load(path, ctx.max_edit_bytes)

    edit_ctx = assemble_edit(ctx, path, lines, previous)

    required = set()
    for operation, refs in parsed:
        for number, suffix in refs:
            if number not in previous:
                refuse(edit_ctx, "Unknown or unread reference", number)
            if previous[number] >> 52 != suffix:
                refuse(edit_ctx, "Reference hash belongs to different content or file", number)
        start, end = refs[0][0], refs[-1][0]
        if end - start + 1 > len(previous):
            refuse(edit_ctx, "Replace range contains unread lines", start)
        for number in range(start, end + 1):
            if number not in previous:
                refuse(edit_ctx, "Replace range contains unread lines", number)
            required.add(number)
    mapping, moved, aligned_windows = align_references(edit_ctx, required)
    prepared = []
    for operation, refs in parsed:
        old_start, old_end = refs[0][0], refs[-1][0]
        start, end = mapping[old_start] - 1, mapping[old_end]
        if any(mapping[number] != start + number - old_start + 1
               for number in range(old_start, old_end + 1)):
            refuse(edit_ctx, "Replace range contains changed or inserted interior lines", old_start)
        if operation["op"] == "insert":
            start += operation["where"] == "after"
            end = start
        prepared.append((start, end, operation))
    prepared.sort(key=lambda item: (item[0], item[1]))
    for (a, b, _), (c, d, _) in zip(prepared, prepared[1:]):
        if c < b or a == b == c == d:
            refuse(edit_ctx, "Edit operations overlap", c + 1)
    translated = {number: digest for number, digest in previous.items()
                  if number not in moved and current_hash(edit_ctx, number) == digest}
    for aligned in aligned_windows:
        for number, target in aligned.items():
            translated[target] = previous[number]
    newline = next(("\r\n" if line.endswith("\r\n") else "\n" for line in lines if line.endswith("\n")), "\n")
    final_newline = lines[-1].endswith("\n")
    updated, spans, cursor = [], [], 0
    for start, end, operation in prepared:
        updated.extend(lines[cursor:start])
        text = operation["text"]
        replacement = [] if text == "" and operation["op"] == "replace" else [
            _logical(line) + newline for line in _split(text)]
        new_start = len(updated)
        updated.extend(replacement)
        spans.append((start, end, new_start, len(updated)))
        cursor = end
    updated.extend(lines[cursor:])
    if not updated:
        updated = [""]
        start, end, new_start, _ = spans[-1]
        spans[-1] = (start, end, new_start, 1)
    else:
        for index in range(len(updated) - 1):
            if not updated[index].endswith("\n"):
                updated[index] += newline
        if not final_newline:
            generated = any(start <= len(updated) - 1 < end for _, _, start, end in spans)
            # Remove the separator we added, not a payload's bare EOF CR.
            updated[-1] = updated[-1][:-len(newline)] if generated else _logical(updated[-1])
    after = bom + "".join(updated).encode("utf-8")
    changes = [span for span in spans if lines[span[0]:span[1]] != updated[span[2]:span[3]]]
    edits = []
    working = "".join(lines).replace("\r\n", "\n")
    for start, end, new_start, new_end in reversed(changes or spans):
        old_text = "".join(lines[start:end]).replace("\r\n", "\n")
        new_text = "".join(updated[new_start:new_end]).replace("\r\n", "\n")
        position = len("".join(lines[:start]).replace("\r\n", "\n"))
        if start == end:
            if start:
                old_text = lines[start - 1].replace("\r\n", "\n")
                position -= len(old_text)
                new_text = updated[new_start - 1].replace("\r\n", "\n") + new_text
            else:
                old_text = lines[0].replace("\r\n", "\n")
                new_text += old_text
        if working[position:position + len(old_text)] != old_text:
            raise HashlineError("Cannot map the edit to an exact native-tool replacement")
        low, high, radius = position, position + len(old_text), 64
        while (not old_text and working) or working.find(old_text) != low or working.find(old_text, low + 1) != -1:
            left, right = max(0, low - radius), min(len(working), high + radius)
            new_text = working[left:low] + new_text + working[high:right]
            low, high = left, right
            old_text = working[low:high]
            radius *= 2
            if len(old_text.encode("utf-8")) + len(new_text.encode("utf-8")) > 1024 * 1024:
                raise HashlineError("Unique native edit context exceeds the 1 MiB callback limit; nothing written")
        working = working[:low] + new_text + working[high:]
        edits.append({"oldText": old_text, "newText": new_text})
    outcome = _call(ctx, "edit", path=path, edits=edits)
    actual_path = _path(outcome.get("path") or path)
    actual, _, actual_lines, _ = _load(actual_path, ctx.max_edit_bytes)
    details = outcome.get("details") or {}
    formatted = bool(details.get("hash") and hashlib.sha256(actual).hexdigest() != details["hash"])
    if actual != after or actual_path != path:
        # The public tool outcome is authoritative after argument/result hooks.
        changes = [(a, b, c, d) for tag, a, b, c, d in _opcodes(lines, actual_lines) if tag != "equal"]
        updated = actual_lines
        if actual_path != path:
            ctx.shown.pop(path, None)
            translated = {}
            path = actual_path
    served = {}
    for number, digest in translated.items():
        index, delta, deleted = number - 1, 0, False
        for start, end, new_start, new_end in changes:
            if start <= index < end:
                deleted = True
                break
            if end <= index:
                delta += (new_end - new_start) - (end - start)
        if not deleted:
            served[number + delta] = digest
    ctx.shown[path] = served
    result = _diff(ctx, path, lines, updated, changes)
    result.update(tool_content=outcome.get("content", []), formatted=formatted)
    return result

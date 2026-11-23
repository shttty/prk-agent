from .hashline_limits import _ROWS, _BUDGET
from .references.resolve_path import _path
from .references.hash_line import _hash
from .references.format_reference import _ref
from .content.validate_text import _text
from .display.measure_display_row import _size
from .display.assemble_result import _Result


def grep(ctx, hits, *, limit_reached=False, output_limited=False):
    """Budget supplied full logical lines; never invoke a search subprocess."""
    groups, hashes, size, count, has_match = {}, {}, 0, 0, False
    result = _Result(files=[], matches=0, truncated=False,
                     limit_reached=bool(limit_reached), output_limited=bool(output_limited))
    for hit in hits:
        if not isinstance(hit, dict) or not {"path", "number", "text", "match"} <= hit.keys():
            raise ValueError("grep hits require path/number/text/match")
        path, number, text, match = _path(hit["path"]), hit["number"], hit["text"], hit["match"]
        if type(number) is not int or number < 1 or type(match) is not bool:
            raise ValueError("grep hit number must be positive and match must be boolean")
        _text(text)
        if "\n" in text:
            raise ValueError("grep hit text must be a logical line without LF")
        rows = groups.get(path, {})
        digest = _hash(path, text)
        if number in rows:
            if hashes[path, number] != digest:
                raise ValueError("grep received inconsistent text for the same line")
            if match and not rows[number]["match"]:
                if size + 1 > _BUDGET:
                    result["output_limited"] = True
                    break
                size += 1
                rows[number]["match"] = True
            has_match = has_match or match
            continue
        row = {"number": number, "ref": _ref(number, digest), "text": text[:2000],
               "omitted": False, "match": match, "truncated": len(text) > 2000,
               "omitted_chars": max(0, len(text) - 2000)}
        header = len((f"[{path!r}]\n").encode("utf-8")) if not rows else 0
        # Retain room for the first actual match after leading context.
        reserve = 8500 if not match and not has_match else 0
        if count >= _ROWS - bool(reserve) or size + header + _size(row) > _BUDGET - reserve:
            result["output_limited"] = True
            if reserve:
                continue
            break
        groups.setdefault(path, rows)[number] = row
        hashes[path, number] = digest
        size += header + _size(row)
        count += 1
        has_match = has_match or match
    for path, rows in groups.items():
        ordered = [rows[number] for number in sorted(rows)]
        result["files"].append({"path": path, "lines": ordered})
        ctx.shown.setdefault(path, {}).update({number: hashes[path, number] for number in rows})
    result["matches"] = sum(row["match"] for group in result["files"] for row in group["lines"])
    result["truncated"] = (result["limit_reached"] or result["output_limited"]
                           or any(row["truncated"] for group in result["files"] for row in group["lines"]))
    return result

import hashlib
from .call_file_tool import _call
from .hashline_limits import _ROWS, _BUDGET
from .references.resolve_path import _path
from .content.validate_text import _text
from .content.scan_page import _scan
from .display.create_display_row import _row
from .display.measure_display_row import _size
from .display.assemble_result import _Result


_HASH_CHUNK_BYTES = 256 * 1024


def write(ctx, path, content):
    """Call native write, retire displayed refs, and report post-hook diagnostics."""
    _text(content)
    path = _path(path)
    outcome = _call(ctx, "write", path=path, content=content)
    ctx.shown.pop(path, None)
    actual_path = _path(outcome.get("path") or path)
    ctx.shown.pop(actual_path, None)
    details = outcome.get("details") or {}
    result = _Result(path=actual_path, written=len(content), tool_content=outcome.get("content", []))
    if details.get("hash"):
        digest = hashlib.sha256()
        with open(actual_path, "rb") as stream:
            while chunk := stream.read(_HASH_CHUNK_BYTES):
                digest.update(chunk)
        actual_hash = digest.hexdigest()
        result["formatted"] = actual_hash != details["hash"]
        if result["formatted"]:
            served = {}
            with open(actual_path, "rb") as stream:
                rows, size = [], 0
                for number, digest, text, length, eof in _scan(stream, actual_path, 1):
                    row = _row(actual_path, number, text, digest=digest, size=length)
                    if len(rows) >= _ROWS or size + _size(row) > _BUDGET:
                        break
                    rows.append(row)
                    served[number] = digest
                    size += _size(row)
            result["lines"] = rows
            ctx.shown[actual_path] = served
    return result

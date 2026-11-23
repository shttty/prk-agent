import codecs
import os
from ..hashline_limits import _BOM, _CHUNK, _PREVIEW
from ..references.create_salted_hash import _base
from ..references.read_hash_digest import _digest
from .check_encoding import _check_encoding


def _scan(stream, path, first):
    """Yield bounded previews; preceding lines are validated but not hashed/kept."""
    prefix = stream.read(4)
    _check_encoding(prefix)
    stream.seek(len(_BOM) if prefix.startswith(_BOM) else 0)
    # Count skipped LF delimiters in bounded chunks rather than allocating a
    # decoder/hash/row per preceding line (important for million-line offsets).
    number = 1
    decoder = codecs.getincrementaldecoder("utf-8")()
    while number < first:
        chunk = stream.read(64 * 1024)
        if not chunk:
            decoder.decode(b"", final=True)
            return
        count = chunk.count(b"\n")
        if count >= first - number:
            end = -1
            for _ in range(first - number):
                end = chunk.find(b"\n", end + 1)
            stream.seek(end + 1 - len(chunk), os.SEEK_CUR)
            chunk = chunk[:end + 1]
            count = first - number
        if b"\0" in chunk:
            raise ValueError("UTF-8 text required; binary/NUL is unsupported")
        number += count
        decoder.decode(chunk, final=number == first)
    base = _base(path)
    number = first - 1
    while True:
        number += 1
        digest = base.copy()
        decoder = codecs.getincrementaldecoder("utf-8")()
        preview = bytearray()
        size, pending, found = 0, b"", False
        while True:
            chunk = stream.readline(_CHUNK)
            found = found or bool(chunk)
            ended = chunk.endswith(b"\n")
            content = pending + (chunk[:-1] if ended else chunk)
            if ended:
                if content.endswith(b"\r"):
                    content = content[:-1]
                pending = b""
            elif chunk:
                content, pending = content[:-1], content[-1:]
            else:
                pending = b""
            if b"\0" in content:
                raise ValueError("UTF-8 text required; binary/NUL is unsupported")
            decoder.decode(content, final=ended or not chunk)
            digest.update(content)
            size += len(content)
            if len(preview) < _PREVIEW:
                preview.extend(content[:_PREVIEW - len(preview)])
            if ended or not chunk:
                break
        if not found and number > 1:
            return
        eof = not stream.peek(1)
        text = preview.decode("utf-8") if size <= _PREVIEW else None
        yield number, _digest(digest), text, size, eof
        if eof:
            return

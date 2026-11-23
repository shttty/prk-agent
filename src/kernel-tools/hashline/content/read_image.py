import base64
import os
from ..call_file_tool import _call
from ..display.assemble_result import _Result
from ..hashline_limits import _IMAGE_BYTES, _SNIFF_BYTES
from .detect_image_mime import _detect_image_mime


def _publish_image(mime: str, payload: bytes) -> None:
    import sys
    runtime = sys.modules.get("_prk_runtime")
    if runtime is not None:
        runtime.display({mime: base64.b64encode(payload).decode("ascii")}, raw=True)


def _read_image(ctx, path: str):
    with open(path, "rb") as stream:
        header = stream.read(_SNIFF_BYTES)
        mime = _detect_image_mime(header)
        if mime is None:
            return None
        size = os.fstat(stream.fileno()).st_size
        if size > _IMAGE_BYTES:
            raise ValueError("Image file exceeds 20 MiB limit")
        payload = header + stream.read(_IMAGE_BYTES - len(header) + 1)
        if len(payload) > _IMAGE_BYTES:
            raise ValueError("Image file exceeds 20 MiB limit")
    outcome = _call(ctx, "read", path=path, offset=1, limit=1)
    _publish_image(mime, payload)
    return _Result(
        path=path,
        mime_type=mime,
        size_bytes=len(payload),
        lines=[],
        total_lines=None,
        truncated=False,
        next_offset=None,
        tool_content=outcome.get("content", []),
    )

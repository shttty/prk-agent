"""Typed shapes of what read/edit/write/grep return and edit accepts; the stubs shown to the model render these."""
from typing import Annotated, Any, Literal, Optional, TypedDict


class _ReadLineBase(TypedDict):
    number: int
    ref: Annotated[str, "N#hhh: pass to edit() as start/end/ref"]
    text: Annotated[Optional[str], "None when the line is too long to show; its ref still edits the whole line"]
    omitted: bool


class ReadLine(_ReadLineBase, total=False):
    bytes: Annotated[int, "size of an omitted line"]


class _ReadResultBase(TypedDict):
    path: str
    lines: list[ReadLine]
    total_lines: Annotated[Optional[int], "None until a scan reaches the end of the file"]
    truncated: bool
    next_offset: Annotated[Optional[int], "line number to pass as offset for the next page; None at the end"]
    tool_content: list[dict[str, Any]]


class ReadResult(_ReadResultBase, total=False):
    mime_type: Annotated[str, "images only; the image is attached to the cell output"]
    size_bytes: Annotated[int, "images only"]


class _DiffLineBase(TypedDict):
    number: int
    ref: Annotated[str, "N#hhh: '+' and ' ' refs are current, '-' refs are old"]
    text: Optional[str]
    omitted: bool
    kind: Literal["-", "+", " "]


class DiffLine(_DiffLineBase, total=False):
    bytes: int


class ReplaceEdit(TypedDict):
    op: Literal["replace"]
    start: Annotated[str, "ref of the first line replaced"]
    end: Annotated[str, "ref of the last line replaced (inclusive)"]
    text: Annotated[str, "new lines; an empty string deletes the range"]


class InsertEdit(TypedDict):
    op: Literal["insert"]
    ref: str
    where: Literal["before", "after"]
    text: str


class EditResult(TypedDict):
    path: str
    diff: list[DiffLine]
    truncated: bool
    tool_content: list[dict[str, Any]]
    formatted: Annotated[bool, "a target-side formatter changed the written bytes"]


class _WriteResultBase(TypedDict):
    path: str
    written: Annotated[int, "characters written"]
    tool_content: list[dict[str, Any]]


class WriteResult(_WriteResultBase, total=False):
    formatted: bool
    lines: Annotated[list[ReadLine], "only when formatted: the file as it is now"]


class GrepLine(TypedDict):
    number: int
    ref: Annotated[str, "N#hhh: editable like a read() ref"]
    text: str
    omitted: bool
    match: bool
    truncated: bool
    omitted_chars: int


class GrepFile(TypedDict):
    path: str
    lines: list[GrepLine]


class GrepResult(TypedDict):
    files: Annotated[list[GrepFile], "empty when nothing matched"]
    matches: int
    truncated: bool
    limit_reached: bool
    output_limited: bool

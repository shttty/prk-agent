from typing import Union
from prk_tool import host, tool
from .file_state import _ctx
from .file_types import EditResult, InsertEdit, ReplaceEdit


@tool
def edit(path: str, operations: list[Union[ReplaceEdit, InsertEdit]]) -> EditResult:
    """Edit a file by the N#hhh refs that read()/grep() displayed. Use instead of sed/str.replace; batch one file's changes into one call.

    Replace is {'op':'replace','start':ref,'end':ref,'text':'new lines'} (inclusive; empty text
    deletes); insert is {'op':'insert','ref':ref,'where':'before'|'after','text':'new lines'}.
    Example: view = read('f.txt'); a = view['lines'][0]['ref']; print(edit('f.txt', [{'op':'replace','start':a,'end':a,'text':'new'}])).
    Every line in a range must have been displayed for this file and still match. Disjoint
    operations validate together, then the native edit runs once through plugin hooks. Nearby
    unique shifts are aligned; a reference conflict returns fresh nearby refs. print(result)
    shows the actual post-hook diff, where '+' and context refs are live (also after
    target-side formatting) and '-' refs are old. Line numbers shift after an edit: use the new
    number with the unchanged suffix. write() clears a file's refs, and after a kernel restart
    or sleep read the file again. BOM/CRLF style survives and the EOF newline state is kept
    unless a terminal empty logical row adds one. Callback JSON is limited to 1 MiB and native
    results to 256 KiB; oversize edits and live local vim/emacs locks are refused. There is no
    cooperative file lock or cross-writer transaction.
    """
    host.trace("write", path)
    return _ctx._session.edit(path, operations)

from ..hashline_limits import _PREVIEW
from ..references.hash_line import _hash
from ..references.format_reference import _ref


def _row(path, number, text, *, digest=None, size=None, kind=None):
    digest = _hash(path, text) if digest is None else digest
    size = len(text.encode("utf-8")) if size is None else size
    omitted = text is None or size > _PREVIEW
    row = {"number": number, "ref": _ref(number, digest),
           "text": None if omitted else text, "omitted": omitted}
    if omitted:
        row["bytes"] = size
    if kind is not None:
        row["kind"] = kind
    return row

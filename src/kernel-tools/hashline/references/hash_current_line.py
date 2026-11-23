from ..content.strip_line_ending import _logical
from .hash_line import _hash


def current_hash(ctx, number):
    if number not in ctx.current_hashes:
        ctx.current_hashes[number] = _hash(ctx.path, _logical(ctx.lines[number - 1])) if 1 <= number <= len(ctx.lines) else None
    return ctx.current_hashes[number]

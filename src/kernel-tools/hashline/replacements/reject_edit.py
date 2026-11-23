from ..display.display_conflict_context import _context
from ..assemble_error import HashlineError


def refuse(ctx, message, number):
    raise HashlineError(message + "; nothing written. Read again or use the current references below",
                        _context(ctx.session, ctx.path, ctx.lines, number))

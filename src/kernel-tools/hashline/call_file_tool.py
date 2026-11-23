from .assemble_error import HashlineError


def _call(ctx, name, **args):
    result = ctx.execute(name, args)
    if result.get("isError"):
        text = "\n".join(part["text"] for part in result.get("content", []) if part.get("type") == "text")
        raise HashlineError(text or f"Native {name} failed")
    return result

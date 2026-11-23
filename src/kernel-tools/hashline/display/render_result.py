from .render_line import _render


def __str__(ctx):
    output = []
    if "files" in ctx:
        for file in ctx["files"]:
            output.append(f"[{file['path']!r}]")
            output.extend(_render(row) for row in file["lines"])
        if ctx["limit_reached"] or ctx["output_limited"]:
            output.append("[Search output limited; narrow the search.]")
        if not ctx["files"]:
            output.append("[No matches returned.]")
    elif "mime_type" in ctx:
        output.append(f"Read image file [{ctx['mime_type']}]: {ctx['path']}")
    else:
        output.extend(_render(row) for row in ctx.get("lines", ctx.get("diff", [])))
        if "written" in ctx:
            output.append(f"[Wrote {ctx['written']} characters.]")
        if ctx.get("next_offset") is not None:
            output.append(f"[Continue with read(path, offset={ctx['next_offset']}).]")
        if "diff" in ctx:
            if any(row["kind"] == "-" for row in ctx["diff"]):
                output.append("[- references are old; + and context references are current.]")
            if ctx["truncated"]:
                output.append("[Diff truncated; read the changed region for more references.]")
            if not ctx["diff"]:
                output.append("[No changes made.]")
    output.extend(part["text"] for part in ctx.get("tool_content", []) if part.get("type") == "text" and part.get("text"))
    return "\n".join(output)

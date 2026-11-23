def _glob_result_string(ctx):
    output = [repr(path) for path in ctx["files"]] or ["[]"]
    if ctx["limit_reached"]:
        output.append("[truncated: file limit reached; narrow pattern/path or increase limit (max 1000).]")
    if ctx["output_limited"]:
        output.append("[truncated: 50KB output limit reached; narrow pattern/path.]")
    return "\n".join(output)



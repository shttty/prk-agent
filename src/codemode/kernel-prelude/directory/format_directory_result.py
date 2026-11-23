def _directory_result_string(ctx):
    output = [repr(name) for name in ctx["entries"]] or ["[]"]
    if ctx["truncated"]:
        output.append(f"[truncated: use ls(path, offset={ctx['next_offset']}) to continue.]")
    return "\n".join(output)



def _progress(ctx, stream, text):
    """Publish UI-only progress; this MIME never enters model tool output."""
    if stream not in ("stdout", "stderr") or not isinstance(text, str):
        raise ValueError("progress requires stdout/stderr and text")
    ctx._host._display({"application/x-prk-progress+json": {"stream": stream, "text": text}}, raw=True)

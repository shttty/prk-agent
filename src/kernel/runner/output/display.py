import base64
import sys


def display_value(ctx, value, raw=False, metadata=None):
    cell = current_cell(ctx)
    if cell is None:
        if raw:
            # Periodic prelude telemetry has generation scope, never last-cell scope.
            generation_mimes = ("application/x-prk-namespace+json", "application/x-prk-memory+json")
            data = {mime: value[mime] for mime in generation_mimes if mime in value}
            if data:
                emit_message(ctx, "display", data=data, metadata=metadata or {})
            if "text/plain" in value:
                emit_stream(ctx, "stdout", value["text/plain"])
        else:
            emit_stream(ctx, "stdout", repr(value))
        return
    if raw:
        data = value
    else:
        figure_module = sys.modules.get("matplotlib.figure")
        figure_type = getattr(figure_module, "Figure", None)
        if figure_type is not None and isinstance(value, figure_type):
            image = render_figure(value)
        else:
            png = getattr(value, "_repr_png_", None)
            image = png() if callable(png) else None
        if isinstance(image, bytes) and len(image) > ctx.options["maxImageBytes"] - cell.image_bytes:
            emit_message(ctx, "image_omitted")
            return
        data = {"image/png": base64.b64encode(image).decode("ascii")} if isinstance(image, bytes) else {"text/plain": repr(value)}
    if any(mime.startswith("application/x-prk-") for mime in data):
        emit_message(ctx, "display", data=data, metadata=metadata or {})
        return
    for mime, content in data.items():
        if mime.startswith("image/"):
            if mime not in ("image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp"):
                continue
            if len(content) > ((ctx.options["maxImageBytes"] - cell.image_bytes + 2) // 3) * 4:
                emit_message(ctx, "image_omitted")
                continue
            size = len(base64.b64decode(content, validate=True))
            if cell.image_count >= ctx.options["maxImages"] or cell.image_bytes + size > ctx.options["maxImageBytes"]:
                emit_message(ctx, "image_omitted")
                continue
            cell.image_count += 1
            cell.image_bytes += size
            chunk = ctx.options["chunkBytes"]
            for offset in range(0, len(content), chunk):
                emit_message(ctx, "image", imageId=cell.image_count, mimeType=mime,
                             data=content[offset:offset + chunk], final=offset + chunk >= len(content))
        elif mime == "text/plain":
            emit_stream(ctx, "result", content, cell.id)
        else:
            emit_message(ctx, "display", data={mime: content}, metadata=metadata or {})

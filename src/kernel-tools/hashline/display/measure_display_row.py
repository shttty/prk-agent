from .render_line import _render


def _size(row):
    return len((_render(row) + "\n").encode("utf-8"))

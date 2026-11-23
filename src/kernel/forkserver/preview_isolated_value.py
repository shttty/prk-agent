import io


def isolated_type_name(value):
    return type.__dict__["__name__"].__get__(type(value))


class _IsolatedPreviewFull(Exception):
    pass


def preview_isolated_value(value, limit):
    """Render ordinary builtins incrementally; arbitrary __repr__ runs only in the child."""
    output = io.StringIO()
    active = set()

    def append(text):
        remaining = limit - output.tell()
        if len(text) > remaining:
            output.write(text[:remaining])
            raise _IsolatedPreviewFull()
        output.write(text)

    def render(item, depth):
        cls = type(item)
        if cls in (list, tuple, dict, set, frozenset):
            if not item:
                append(repr(item))
                return
            start, end = {list: ("[", "]"), tuple: ("(", ")"), dict: ("{", "}"),
                          set: ("{", "}"), frozenset: ("frozenset({", "})")}[cls]
            if id(item) in active:
                append(start + "..." + end)
                return
            append(start)
            if depth >= 12:
                raise _IsolatedPreviewFull()
            active.add(id(item))
            for index, element in enumerate(item.items() if cls is dict else item):
                if index:
                    append(", ")
                if cls is dict:
                    key, element = element
                    render(key, depth + 1)
                    append(": ")
                render(element, depth + 1)
            if cls is tuple and len(item) == 1:
                append(",")
            append(end)
            active.remove(id(item))
        elif cls in (str, bytes, bytearray) and len(item) > limit - output.tell():
            # Slice the value before calling repr so escaping cannot grow with the input.
            append(repr(item[:limit - output.tell()]))
            raise _IsolatedPreviewFull()
        elif cls is int and item.bit_length() > 4 * (limit - output.tell()):
            append(f"<integer with {item.bit_length()} bits>")
            raise _IsolatedPreviewFull()
        else:
            append(repr(item))

    try:
        render(value, 0)
    except _IsolatedPreviewFull:
        return output.getvalue(), True
    except BaseException as error:
        text = f"<repr failed: {isolated_type_name(error)[:64]}>"
        return text[:limit], len(text) > limit
    return output.getvalue(), False

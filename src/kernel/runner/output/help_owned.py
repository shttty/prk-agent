import pydoc


def help_owned(ctx, request=None):
    """help(obj) printed as the running cell's own output; the stock help() writes past the cell's output."""
    if request is None:
        raise TypeError("help() needs an object or a name, e.g. help(read)")
    print_owned(ctx, pydoc.render_doc(request, renderer=pydoc.plaintext))

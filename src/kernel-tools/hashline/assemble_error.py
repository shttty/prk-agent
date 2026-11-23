class HashlineError(ValueError):
    """An edit/lock conflict, optionally carrying freshly displayed nearby rows."""

    from .initialize_error import initialize_error as __init__

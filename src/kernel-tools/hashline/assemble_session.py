class Session:
    """Sparse displayed hashes; all writes belong to the caller's native-tool outlet."""

    from .initialize_session import __init__
    from .read import read
    from .write import write
    from .grep import grep
    from .edit import edit

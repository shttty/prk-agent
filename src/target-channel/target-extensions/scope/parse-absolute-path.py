def absolute_path(value):
    if not isinstance(value, str) or not os.path.isabs(value) or "\0" in value:
        raise ValueError("remote extension paths must be absolute")
    return os.path.abspath(value)



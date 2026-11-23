def absolute_path(value):
    if not isinstance(value, str) or not os.path.isabs(value):
        raise ValueError("skill paths must be absolute")
    return os.path.abspath(value)



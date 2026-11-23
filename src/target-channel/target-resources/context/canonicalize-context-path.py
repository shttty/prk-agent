def canonical_path(path):
    return os.path.realpath(path) if os.path.exists(path) else path



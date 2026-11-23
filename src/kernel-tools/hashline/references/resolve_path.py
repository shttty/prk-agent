import os


def _path(path):
    return os.path.realpath(os.fspath(path))

from types import SimpleNamespace


def assemble_diff(session, path):
    return SimpleNamespace(session=session, path=path, rows=[], size=0, truncated=False)

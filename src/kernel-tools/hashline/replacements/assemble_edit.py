from types import SimpleNamespace


def assemble_edit(session, path, lines, previous):
    return SimpleNamespace(session=session, path=path, lines=lines, previous=previous,
                           current_hashes={})

from types import SimpleNamespace


def assemble_resource_bodies(file_limit, total_limit):
    return SimpleNamespace(file_limit=file_limit, total_limit=total_limit, used=0)

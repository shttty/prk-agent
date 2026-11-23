def _memory_bytes(value):
    suffix = value[-1:]
    return int(value[:-1]) * 1024 ** ("KMGTPE".index(suffix) + 1) if suffix in "KMGTPE" else int(value)



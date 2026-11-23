def _digest(value):
    return int.from_bytes(value.digest()[:8], "big")

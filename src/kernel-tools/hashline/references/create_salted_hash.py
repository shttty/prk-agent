import hashlib


def _base(path):
    # digest_size=8 would produce a different hash, not the first 64 bits.
    return hashlib.blake2b(path.encode("utf-8") + b"\0")

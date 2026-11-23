import hashlib as _bin_hashlib

def _bin_sha256(path):
    digest = _bin_hashlib.sha256()
    with open(path, "rb") as file:
        for block in iter(lambda: file.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()



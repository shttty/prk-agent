def file_sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as source:
        for chunk in iter(lambda: source.read(MAX_CHUNK_BYTES), b""):
            digest.update(chunk)
    return digest.hexdigest()



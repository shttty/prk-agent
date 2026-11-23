def _editable(metadata):
    if metadata is not None and metadata.st_size > MAX_FILE_BYTES:
        raise ValueError("Editable file exceeds 200 MiB; nothing written")



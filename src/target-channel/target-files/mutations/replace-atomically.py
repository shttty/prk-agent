def _atomic(path, data, metadata):
    descriptor, temporary = tempfile.mkstemp(prefix=".prk-files-", dir=os.path.dirname(path))
    try:
        with os.fdopen(descriptor, "wb") as stream:
            if metadata is not None:
                try:
                    os.fchown(stream.fileno(), metadata.st_uid, metadata.st_gid)
                except OSError as error:
                    if error.errno not in (errno.EPERM, errno.EACCES):
                        raise
                os.fchmod(stream.fileno(), stat.S_IMODE(metadata.st_mode))
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)



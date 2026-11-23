def file_signature(path):
    stat = os.stat(path)
    return (stat.st_size, stat.st_mtime_ns, stat.st_ino, stat.st_ctime_ns)



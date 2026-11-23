def remove_directory(path):
    if not os.path.isdir(path):
        return
    for directory, children, files in os.walk(path, followlinks=False):
        os.chmod(directory, 0o700)
    shutil.rmtree(path)



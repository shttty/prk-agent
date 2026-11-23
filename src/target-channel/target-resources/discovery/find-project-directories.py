def project_directories(cwd):
    current = absolute_path(cwd)
    while True:
        yield current
        if os.path.exists(os.path.join(current, ".git")):
            break
        parent = os.path.dirname(current)
        if parent == current:
            break
        current = parent



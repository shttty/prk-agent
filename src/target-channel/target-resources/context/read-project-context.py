def project_context(cwd, bodies, scans):
    shadowed = shadowed_context(cwd, bodies, scans)
    files = []
    directory = cwd
    while True:
        context = context_from_directory(directory, bodies, scans, shadowed=shadowed)
        if context:
            files.insert(0, context)
        parent = os.path.dirname(directory)
        if parent == directory:
            return files
        directory = parent



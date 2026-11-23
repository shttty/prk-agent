def supporting_files(path):
    files = []
    for directory, children, names in os.walk(os.path.dirname(path)):
        children[:] = [name for name in children if name not in IGNORED_DIRECTORIES]
        for name in names:
            file = os.path.join(directory, name)
            if file != path and os.path.isfile(file):
                files.append(file)
    return sorted(files)[:10]



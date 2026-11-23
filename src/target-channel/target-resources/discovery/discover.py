def discover(cwd, headers=True):
    home = os.path.abspath(os.path.expanduser("~/.agents/skills"))
    paths = [os.path.join(directory, ".agents", "skills") for directory in project_directories(cwd)]
    paths = [path for path in paths if path != home and os.path.isdir(path)]
    scans = []
    entries = []
    for path in paths:
        scan(path, scans, entries, headers)
    return {"directories": [{"path": path} for path in paths], "entries": sorted(entries, key=lambda entry: entry["path"]) if headers else entries, "scans": scans}



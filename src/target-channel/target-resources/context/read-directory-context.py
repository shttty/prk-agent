def context_from_directory(directory, bodies, scans, charge=True, shadowed=None):
    for name in CONTEXT_NAMES:
        path = os.path.join(directory, name)
        if not os.path.isfile(path):
            continue
        if shadowed is not None and os.path.join(canonical_path(directory), name) == shadowed:
            return None
        try:
            return {"path": path, "content": read_body(bodies, path, charge)}
        except ResourceLimitError:
            raise
        except OSError as error:
            scans.append({"path": path, "error": str(error)})
    return None



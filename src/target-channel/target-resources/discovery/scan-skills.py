def scan(root, scans, entries, headers=True):
    queue = [(root, 0)]
    for path, depth in queue:
        node = {"path": path}
        scans.append(node)
        try:
            with os.scandir(path) as iterator:
                children = sorted(iterator, key=lambda entry: entry.name)
            children = [child for child in children if not child.name.startswith(".") and child.name not in IGNORED_DIRECTORIES]
            skill = os.path.join(path, "SKILL.md")
            files = [skill] if os.path.isfile(skill) else [child.path for child in children if depth == 0 and child.name.endswith(".md") and child.is_file()]
            for file in files:
                try:
                    entries.append({"path": file, "frontmatter": frontmatter(file)} if headers else {"path": file})
                except (OSError, ValueError) as error:
                    entries.append({"path": file, "error": str(error)})
            if not os.path.isfile(skill) and depth < MAX_DEPTH:
                for child in children:
                    try:
                        if child.is_dir():
                            queue.append((child.path, depth + 1))
                    except OSError:
                        pass
        except OSError as error:
            node["error"] = str(error)



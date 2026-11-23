def resource_options(command):
    allowed = {"id", "mod", "op", "cwd", "configDir", "runtime", "bundle", "toolDirs", "contextFileBytes", "contextTotalBytes", "noContextFiles", "noSkills", "noPromptTemplates", "noExtensions", "projectTrusted"}
    unknown = set(command) - allowed
    if unknown:
        raise ValueError("unknown resources field: " + sorted(unknown)[0])
    options = dict(command)
    for name in ("cwd", "runtime", "bundle"):
        if name != "cwd" and options.get(name) is None:
            continue
        value = options.get(name)
        if not isinstance(value, str) or not os.path.isabs(value) or "\0" in value:
            raise ValueError(name + " must be an absolute path")
        options[name] = os.path.abspath(value)
    config_dir = options.get("configDir")
    if not isinstance(config_dir, str) or not config_dir or config_dir in (".", "..") or "/" in config_dir or "\0" in config_dir:
        raise ValueError("configDir must be a directory name")
    for name, default in (("contextFileBytes", DEFAULT_CONTEXT_FILE_BYTES), ("contextTotalBytes", DEFAULT_CONTEXT_TOTAL_BYTES)):
        value = options.get(name, default)
        if type(value) is not int or value <= 0:
            raise ValueError(name + " must be a positive integer")
        options[name] = value
    for name in ("noContextFiles", "noSkills", "noPromptTemplates", "noExtensions", "projectTrusted"):
        value = options.get(name, name == "projectTrusted")
        if type(value) is not bool:
            raise ValueError(name + " must be a boolean")
        options[name] = value
    tool_dirs = options.get("toolDirs", [])
    if not isinstance(tool_dirs, list) or any(not isinstance(path, str) or not os.path.isabs(path) or "\0" in path for path in tool_dirs):
        raise ValueError("toolDirs must contain absolute paths")
    options["toolDirs"] = tool_dirs
    return options



def needs_pi(cwd, config_dir):
    if not os.path.isdir(cwd):
        raise NotADirectoryError("Target session cwd does not exist or is not a directory: " + cwd)
    project = os.path.join(cwd, config_dir)
    return any(os.path.exists(os.path.join(project, name)) for name in ("settings.json", "skills", "prompts", "extensions"))



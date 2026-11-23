def handle(command):
    op = command.get("op")
    if op == "discover":
        return discover(command.get("cwd"))
    if op == "probe":
        options = resource_options(command)
        return {"requiresPi": needs_pi(options["cwd"], options["configDir"])}
    if op == "registration":
        return registration_versions(command)
    if op == "resources":
        try:
            return resources(command)
        except ResourceLimitError as error:
            return {"validationError": str(error)}
    if op == "read":
        return read(command)
    if op == "files":
        return {"files": supporting_files(absolute_path(command.get("path")))}
    raise ValueError("unknown skills operation: " + str(op))


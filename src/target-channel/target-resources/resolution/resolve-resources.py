def resources(command):
    options = resource_options(command)
    bodies = assemble_resource_bodies(options["contextFileBytes"], options["contextTotalBytes"])
    resolver_required = options["projectTrusted"] and needs_pi(options["cwd"], options["configDir"])
    if resolver_required and not (options.get("runtime") and options.get("bundle")):
        raise ValueError("Target project resources require the Pi resolver: " + options["cwd"])
    result = {"directories": [], "entries": [], "scans": [], "agentsFiles": [], "prompts": [], "extensions": []}
    if not options["noContextFiles"]:
        result["agentsFiles"] = project_context(options["cwd"], bodies, result["scans"])
    if options["projectTrusted"]:
        settings_path = os.path.join(options["cwd"], options["configDir"], "settings.json")
        if os.path.exists(settings_path):
            result["settings"] = read_body(bodies, settings_path)
    if not options["noSkills"]:
        skills = discover(options["cwd"], headers=False) if options["projectTrusted"] else {"directories": [], "scans": [], "entries": []}
        result["directories"] = skills["directories"]
        result["scans"].extend(skills["scans"])
    else:
        skills = {"entries": []}
    if resolver_required:
        request = {name: options[name] for name in ("cwd", "configDir", "contextFileBytes", "contextTotalBytes", "noSkills", "noPromptTemplates", "noExtensions", "projectTrusted")}
        request.update(settings=result.get("settings"), usedBodyBytes=bodies.used,
                       agentsDirectories=result["directories"], agentsEntries=skills["entries"])
        environment = dict(os.environ)
        # Pi offline mode skips missing packages before the public onMissing policy.
        # This short-lived resolver rejects that policy and never installs or refreshes.
        environment["PI_OFFLINE"] = "0"
        environment["PATH"] = os.pathsep.join(options["toolDirs"] + [environment.get("PATH", os.defpath)])
        child = subprocess.run([options["runtime"], os.path.join(options["bundle"], "resources/run-resource-resolver.mjs")],
                               input=json.dumps(request).encode("utf-8"), stdout=subprocess.PIPE,
                               stderr=subprocess.PIPE, env=environment, cwd=options["cwd"])
        if child.returncode:
            raise ValueError("target resource discovery failed: " + child.stderr.decode("utf-8", "replace").strip())
        reply = json.loads(child.stdout.decode("utf-8"))
        if isinstance(reply, dict) and isinstance(reply.get("validationError"), str):
            raise ResourceLimitError(reply["validationError"])
        if not isinstance(reply, dict) or any(not isinstance(reply.get(name), list) for name in ("prompts", "extensions", "skills", "agentsPaths")):
            raise ValueError("invalid target resource discovery response")
    else:
        reply = {"prompts": [], "extensions": [], "skills": [], "agentsPaths": [entry["path"] for entry in skills["entries"]]}
    for prompt in reply["prompts"]:
        path = absolute_path(prompt.get("path"))
        content = prompt.get("content")
        if not isinstance(content, str):
            raise ValueError("invalid target prompt body: " + path)
        consume_body_budget(bodies, path, content)
        result["prompts"].append({"path": path, "content": content})
    result["extensions"] = [absolute_path(path) for path in reply["extensions"]]
    paths = []
    package_paths = []
    for skill in reply["skills"]:
        path = absolute_path(skill.get("path"))
        root = absolute_path(skill.get("directory"))
        if not path.startswith(root.rstrip(os.sep) + os.sep):
            raise ValueError("target skill path is outside its directory: " + path)
        if not any(directory["path"] == root for directory in result["directories"]):
            result["directories"].append({"path": root})
        target = package_paths if skill.get("afterAgents") else paths
        if path not in target:
            target.append(path)
    for path in reply["agentsPaths"] + package_paths:
        path = absolute_path(path)
        if path not in paths:
            paths.append(path)
    for path in paths:
        try:
            result["entries"].append({"path": path, "frontmatter": read_frontmatter(bodies, path)})
        except ResourceLimitError:
            raise
        except (OSError, ValueError) as error:
            result["entries"].append({"path": path, "error": str(error)})
    return result



import platform as _bin_platform


def tool_bin(name: str) -> str:
    """Absolute path of a Gateway-distributed Linux CLI on this target, e.g. tool_bin('rg'); needs the instance environment deployed.

    The binary is sent and sha256-cached on first use, then verified before each path is returned.
    Raises ENVIRONMENT_REQUIRED when the instance environment has not been deployed.
    """
    request = {"name": name, "system": _bin_platform.system(), "machine": _bin_platform.machine()}
    asset = _bin_request(request)
    path = _os.path.join(_os.path.expanduser(_config["targetCacheRoot"]), "bin", asset["sha256"], name)
    signature = _bin_signature(path) if _os.path.isfile(path) else None
    if signature is None or _bin_verified.get(path) != signature:
        if signature is None or _bin_sha256(path) != asset["sha256"]:
            raise RuntimeError(f"ENVIRONMENT_REQUIRED: deploy the instance environment before using {name}")
        _bin_verified[path] = signature
    if not _os.access(path, _os.X_OK):
        raise RuntimeError(f"tool_bin: {path} is not executable (noexec mount?); set targetCacheRoot to an executable directory")
    return path



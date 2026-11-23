import { posix } from "node:path";
import { MANAGED_PYTHON } from "../../artifacts/python/python-release.ts";

export interface ManagedPythonPaths {
  uv: string;
  uvLauncher: string;
  python: string;
  venv: string;
  venvPython: string;
  installDir: string;
  cache: string;
  mirror: string;
  archive: string;
}

export function managedPythonPaths(root: string, instance: string): ManagedPythonPaths {
  const { uv, python, distribution, release } = MANAGED_PYTHON;
  const installDir = posix.join(root, "python");
  const venv = posix.join(root, "venvs", encodeURIComponent(instance).replaceAll(".", "%2E"));
  const mirror = posix.join(root, "python-mirror", python.sha256);
  return {
    uv: posix.join(root, "bin", uv.sha256, uv.filename),
    uvLauncher: posix.join(root, "bin", uv.sha256, "launcher", "uv"),
    python: posix.join(installDir, distribution, "bin", "python3.12"),
    venv, venvPython: posix.join(venv, "bin", "python"),
    installDir, cache: posix.join(root, "uv-cache"), mirror,
    archive: posix.join(mirror, release, python.filename),
  };
}

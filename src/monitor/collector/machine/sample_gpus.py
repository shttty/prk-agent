def sample_gpus(ctx):
    if not ctx.gpu_checked:
        ctx.gpu_checked = True
        ctx.has_gpu = any(
            os.access(os.path.join(p, "nvidia-smi"), os.X_OK)
            for p in os.environ.get("PATH", "").split(os.pathsep) if p
        )
    if not ctx.has_gpu:
        return []
    try:
        out = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.used,memory.total,utilization.gpu",
             "--format=csv,noheader,nounits"],
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=GIT_TIMEOUT_S,
        )
        if out.returncode != 0:
            return []
        gpus = []
        for line in out.stdout.decode("utf-8", "replace").splitlines():
            name, used, total, util = [x.strip() for x in line.rsplit(",", 3)]
            gpus.append({"name": name, "memUsed": int(used) << 20, "memTotal": int(total) << 20, "util": int(util)})
        return gpus
    except (OSError, ValueError, subprocess.SubprocessError):
        return []

def read_cpu_times(ctx):
    try:
        lines = read_proc_file(ctx, "stat").splitlines()
        fields = [int(x) for x in lines[0].split()[1:]]
        cores = sum(1 for line in lines if line.startswith("cpu") and line[3:4].isdigit())
        # idle + iowait are "not busy"
        return (sum(fields), fields[3] + (fields[4] if len(fields) > 4 else 0), cores)
    except (OSError, ValueError, IndexError):
        return None

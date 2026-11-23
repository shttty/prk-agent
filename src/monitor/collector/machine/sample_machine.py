def sample_machine(ctx):
    return {"t": "machine", "cpu": sample_cpu(ctx), "load": sample_load(ctx), "mem": sample_memory(ctx),
            "disk": disk_of("/"), "gpus": sample_gpus(ctx)}

from types import SimpleNamespace


def assemble_machine(proc):
    ctx = SimpleNamespace(proc=proc, gpu_checked=False, has_gpu=False)
    ctx.prev_cpu = read_cpu_times(ctx)
    return ctx

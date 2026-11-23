def read_proc_file(ctx, name):
    with open(os.path.join(ctx.proc, name)) as handle:
        return handle.read()

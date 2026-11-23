def start_threads(ctx):
    threading.Thread(target=partial(read_frames, ctx), daemon=True).start()
    threading.Thread(target=partial(write_frames, ctx), daemon=True).start()
    ctx.watcher = threading.Thread(target=partial(watch_child, ctx), daemon=True)
    ctx.watcher.start()


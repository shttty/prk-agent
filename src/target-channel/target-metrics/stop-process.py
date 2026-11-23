def stop_process(process):
    try:
        os.killpg(process.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    for stream in (process.stdout, process.stderr):
        stream.close()



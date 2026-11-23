from types import SimpleNamespace


def assemble_child(generation, process, connection, scope, emit, exited, directory, exit_status):
    return SimpleNamespace(generation=generation, process=process, connection=connection,
                           scope=scope, directory=directory, scope_path=None, cleanup_error=None, host_pid=None,
                           exit_status=exit_status, host_exit_code=None,
                           startup_stderr="", emit=emit, exited=exited,
                           outgoing=queue.Queue(maxsize=256), stopping=threading.Event(),
                           termination_lock=threading.Lock(), terminated=False,
                           log_threads=[], watcher=None, frame_input=None)

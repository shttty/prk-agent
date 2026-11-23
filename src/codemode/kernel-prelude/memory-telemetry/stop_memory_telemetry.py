def _memory_cleanup():
    _memory_stop.set()
    _memory_thread.join()



def _memory_loop():
    # Idle kernels stay silent except for an OOM-kill change; busy cells sample every interval.
    while not _memory_stop.wait(_memory_interval):
        _memory_publish(periodic=True)



import struct


def decode_timer_wait(number, arguments, block, name, sampled_at_ns):
    """Interpret only native Linux x86_64 waits with no effective descriptors."""
    if number in (7, 23, 270, 271) and arguments[0 if number in (23, 270) else 1] != 0:
        return None
    if number == 7:  # poll's timeout is a signed C int, not a machine word.
        milliseconds = arguments[2] & 0xFFFFFFFF
        if milliseconds >= 0x80000000:
            return None
        return _timer_step(name, milliseconds)
    if block is None:
        return None

    seconds, fraction = struct.unpack("<qq", block)
    scale = 1_000_000 if number == 23 else 1_000_000_000  # select timeval; otherwise timespec
    if seconds < 0 or not 0 <= fraction < scale:
        return None
    nanoseconds = seconds * 1_000_000_000 + fraction * (1_000_000_000 // scale)
    absolute = False
    if number == 230:
        clock, flags = arguments[:2]
        if clock == 1 and flags == 1:  # CLOCK_MONOTONIC / TIMER_ABSTIME
            nanoseconds = max(0, nanoseconds - sampled_at_ns)
            absolute = True
        elif clock not in (0, 1, 7) or flags != 0:  # Relative REALTIME, MONOTONIC, BOOTTIME only.
            return None
    return _timer_step(name, (nanoseconds + 999_999) // 1_000_000, absolute)


def _timer_step(name, milliseconds, absolute=False):
    if milliseconds > (1 << 53) - 1:
        return None
    basis = "CLOCK_MONOTONIC absolute deadline" if absolute else "relative timeout upper bound"
    return _stop_step("timer", "bounded", f"{name}: {basis}", remainingMs=milliseconds)

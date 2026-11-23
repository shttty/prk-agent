import struct


_SOCKET_DIRECT_WAITS = {0: "read", 19: "readv", 42: "connect", 45: "recvfrom", 47: "recvmsg"}
_SOCKET_SET_WAITS = (7, 23, 270, 271)  # poll, select, pselect6, ppoll
_MAX_WAIT_FDS = 1024


def _socket_wait_selection(number, arguments):
    if number in _SOCKET_DIRECT_WAITS:
        fd = arguments[0]
        if fd >= 1 << 31:
            raise _SocketWaitRejected("Descriptor is not a valid native int")
        return fd, ()

    is_poll = number in (7, 271)
    count = arguments[1 if is_poll else 0]
    if not 0 < count <= _MAX_WAIT_FDS:
        raise _SocketWaitRejected("Descriptor set size is outside the observation bound")
    if is_poll:
        entries = _read_worker_parameters(arguments[0], count * 8)
        if entries is None:
            raise _SocketWaitRejected("Cannot read the complete poll descriptor set")
        fds = {fd for fd, _, _ in struct.iter_unpack("<ihh", entries) if fd >= 0}
        if len(fds) != 1:
            raise _SocketWaitRejected("Poll set does not identify a single descriptor")
        return fds.pop(), (entries,)

    # The native kernel copies unsigned-long words, not whole libc fd_set structs.
    size = ((count + 63) // 64) * 8
    sets = tuple(_read_worker_parameters(address, size) if address else b"" for address in arguments[1:4])
    if any(block is None for block in sets):
        raise _SocketWaitRejected("Cannot read the complete select descriptor sets")
    readable, writable, exceptional = (int.from_bytes(block, "little") for block in sets)
    mask = (1 << count) - 1
    candidates = (readable | writable | exceptional) & mask
    if not candidates or candidates & (candidates - 1):
        raise _SocketWaitRejected("Select sets do not identify a single descriptor")
    if not candidates & (readable | writable):
        raise _SocketWaitRejected("Exception-only select wait is not eligible")
    return candidates.bit_length() - 1, sets

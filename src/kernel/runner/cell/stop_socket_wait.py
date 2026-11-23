import errno
import os
import socket
import stat
import struct
import sys


def _bind_pinned_socket_api():
    if sys.platform != "linux":
        return None
    try:
        from ctypes import CDLL, POINTER, byref, c_int, c_uint, c_void_p, create_string_buffer, get_errno

        libc = CDLL(None, use_errno=True)
        get_option = libc.getsockopt
        get_option.argtypes = (c_int, c_int, c_int, POINTER(c_int), POINTER(c_uint))
        get_peer = libc.getpeername
        get_peer.argtypes = (c_int, c_void_p, POINTER(c_uint))
        shutdown = libc.shutdown
        shutdown.argtypes = (c_int, c_int)
        domain_option, protocol_option = socket.SO_DOMAIN, socket.SO_PROTOCOL
    except (ImportError, AttributeError, OSError):
        return None

    def checked(result):
        if result != 0:
            code = get_errno()
            raise OSError(code, os.strerror(code))

    def option(fd, name):
        value, size = c_int(), c_uint(4)
        checked(get_option(fd, socket.SOL_SOCKET, name, byref(value), byref(size)))
        if size.value != 4:
            raise _SocketWaitRejected("Incomplete pinned socket metadata")
        return value.value

    def describe(fd):
        if option(fd, socket.SO_TYPE) != socket.SOCK_STREAM:
            raise _SocketWaitRejected("Descriptor is not a stream socket; datagram and resolver waits are not eligible")
        if option(fd, socket.SO_ACCEPTCONN):
            raise _SocketWaitRejected("Listening sockets are not eligible")
        domain = option(fd, domain_option)
        if domain == socket.AF_UNIX:
            return "Unix stream"
        if domain not in (socket.AF_INET, socket.AF_INET6) or option(fd, protocol_option) != socket.IPPROTO_TCP:
            raise _SocketWaitRejected("Socket is neither a Unix stream nor TCP")
        address = create_string_buffer(28)  # sockaddr_in6; also fits sockaddr_in.
        size = c_uint(len(address))
        try:
            checked(get_peer(fd, address, byref(size)))
        except OSError as error:
            if error.errno != errno.ENOTCONN:
                raise
            return "TCP stream (peer unavailable)"
        if size.value != (16 if domain == socket.AF_INET else 28):
            raise _SocketWaitRejected("Incomplete TCP peer metadata")
        family, = struct.unpack_from("<H", address)
        if family != domain:
            raise _SocketWaitRejected("TCP peer address family does not match socket domain")
        port, = struct.unpack_from("!H", address, 2)
        if port in (53, 853):
            raise _SocketWaitRejected("TCP peer uses a DNS service port; resolver waits are not eligible")
        host = socket.inet_ntop(domain, address[4:8] if domain == socket.AF_INET else address[8:24])
        return f"TCP stream (peer [{host}]:{port})"

    return describe, lambda fd: checked(shutdown(fd, socket.SHUT_RDWR))


# Constructing socket.socket(fileno=...) can set O_NONBLOCK from Python's
# default timeout. Use the native calls so even a rejected dup changes no flags.
_pinned_socket_api = _bind_pinned_socket_api()


class _SocketWaitRejected(Exception):
    pass


def _socket_identity(fd):
    info = os.fstat(fd)
    if stat.S_ISSOCK(info.st_mode) and info.st_ino:
        return info.st_dev, info.st_ino
    return None


def _verify_socket_wait(ctx, cell, thread, tid, sample, selection, first):
    if _read_syscall(tid) != sample:
        raise _SocketWaitRejected("Worker syscall sample changed before shutdown")
    if _socket_wait_selection(*sample) != selection:
        raise _SocketWaitRejected("Worker wait set changed before shutdown")
    if _socket_identity(selection[0]) != first:
        raise _SocketWaitRejected("Current descriptor no longer matches the first socket identity")


def stop_socket_wait(ctx, cell, thread, tid, sample, name, token=None):
    """The caller holds the worker registration gate; only the private duplicate is mutable."""
    if _pinned_socket_api is None:
        return _stop_step("socket", "unavailable", f"{name}: native socket operations are unavailable")
    describe, shutdown = _pinned_socket_api
    phase = "reading the wait set and first socket identity"
    action = {}
    try:
        selection = _socket_wait_selection(*sample)
        fd = selection[0]
        first = _socket_identity(fd)
        if first is None:
            raise _SocketWaitRejected("Descriptor has no verifiable socket identity")
        # /proc did not pin the historical wait object before first fstat. From
        # this point on, reject observed reuse and act only on the retained file.
        phase = "pinning the socket and checking its type"
        duplicate = os.dup(fd)
        try:
            if _socket_identity(duplicate) != first:
                raise _SocketWaitRejected("Pinned descriptor does not match the first socket identity")
            description = describe(duplicate)
            phase = "rechecking the worker wait and socket identity"
            if not _owns_cancelled_worker(ctx, cell, thread, tid, token):
                raise _SocketWaitRejected("Worker registration is no longer current")
            _verify_socket_wait(ctx, cell, thread, tid, sample, selection, first)
            phase = "shutting down or closing the pinned duplicate"
            action = {"action": "shutdown(SHUT_RDWR) on pinned duplicate"}
            if token is not None and (_read_syscall(tid) != sample
                                      or not _owns_cancelled_worker(ctx, cell, thread, tid, token)):
                raise _SocketWaitRejected("Worker registration or syscall changed before shutdown")
            shutdown(duplicate)
        finally:
            os.close(duplicate)
        return _stop_step("socket", "applied", f"{name}: {description}; worker exit is unconfirmed", **action)
    except _SocketWaitRejected as error:
        return _stop_step("socket", "skipped", f"{name}: {error}")
    except OSError as error:
        extra = {"errno": error.errno} if error.errno and error.errno > 0 else {}
        return _stop_step("socket", "unavailable", f"{name}: failed while {phase}", **extra, **action)

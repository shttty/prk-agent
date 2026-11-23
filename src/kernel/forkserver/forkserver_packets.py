from array import array as descriptor_array
import json
import os
import socket


def _forkserver_object(pairs):
    result = dict(pairs)
    if len(result) != len(pairs):
        raise ValueError("duplicate forkserver request field")
    return result


def parse_forkserver_request(raw, generation, cell_kinds, allow_retire=False):
    request = json.loads(raw.decode("utf-8"), object_pairs_hook=_forkserver_object)
    if not isinstance(request, dict) or request.get("generation") != generation:
        raise ValueError("invalid forkserver generation")
    kind = request.get("kind")
    if kind == "retire" and allow_retire and request.keys() == {"kind", "generation"}:
        return kind, None
    if kind in cell_kinds and request.keys() == {"kind", "generation", "cellId"}:
        cell_id = request["cellId"]
        if isinstance(cell_id, str) and 0 < len(cell_id) <= 128:
            return kind, cell_id
    raise ValueError("invalid forkserver request")


def receive_forkserver_control(control, generation):
    fds = descriptor_array("i")
    raw, ancillary, flags, _ = control.recvmsg(
        4096, socket.CMSG_SPACE(2 * fds.itemsize), socket.MSG_CMSG_CLOEXEC)
    endpoints = []
    try:
        # recvmsg may install fds even when it flags truncation.
        for level, kind, value in ancillary:
            if (level, kind) == (socket.SOL_SOCKET, socket.SCM_RIGHTS):
                fds.frombytes(value[:len(value) - len(value) % fds.itemsize])
        if flags & (socket.MSG_TRUNC | socket.MSG_CTRUNC):
            raise ValueError("truncated forkserver request or descriptors")
        if not raw and not ancillary:
            return None
        kind, cell_id = parse_forkserver_request(raw, generation, ("fork", "cancel"))
        if kind == "cancel" and not ancillary:
            return kind, cell_id, None, None
        if kind != "fork" or len(ancillary) != 1 or len(fds) != 2:
            raise ValueError("forkserver requires status and data descriptors only for fork")
        for fd, sock_type in zip(fds, (socket.SOCK_SEQPACKET, socket.SOCK_STREAM)):
            endpoint = socket.socket(fileno=fd)
            endpoints.append(endpoint)
            if endpoint.family != socket.AF_UNIX or endpoint.type != sock_type:
                raise ValueError("invalid forkserver status or data endpoint")
            endpoint.getpeername()
        endpoints[0].setblocking(False)
        return kind, cell_id, *endpoints
    except BaseException as error:
        for endpoint in endpoints:
            endpoint.close()
        for fd in fds[len(endpoints):]:
            os.close(fd)
        if isinstance(error, OSError):
            raise ValueError("invalid forkserver endpoint") from error
        raise


def send_forkserver_packet(peer, generation, cell_id, **fields):
    packet = dict(generation=generation, **fields)
    if cell_id is not None:
        packet["cellId"] = cell_id
    raw = json.dumps(packet).encode()
    try:
        return peer.send(raw, socket.MSG_DONTWAIT | socket.MSG_NOSIGNAL) == len(raw)
    except OSError:
        return False


def reject_forkserver_cell(status, generation, cell_id, reason, threads=None, module=None):
    send_forkserver_packet(status, generation, cell_id, kind="rejected", code="ISOLATION_UNAVAILABLE",
                           reason=reason, threads=threads, preload=module)

import json
import socket
import sys


def control_forkserver(timeout, kind, generation, *cell):
    request = dict(kind=kind, generation=generation)
    if cell:
        request["cellId"], = cell
    with socket.socket(socket.AF_UNIX, socket.SOCK_SEQPACKET) as control:
        control.settimeout(float(timeout))
        control.connect("\0prk-fork-" + generation)
        packet = json.dumps(request).encode()
        if control.send(packet) != len(packet):
            raise OSError("Incomplete forkserver control request")
        raw, _, flags, _ = control.recvmsg(4096)
        if not raw or flags & socket.MSG_TRUNC:
            raise OSError("Missing or oversized forkserver control response")
        print(raw.decode("ascii"))


control_forkserver(*sys.argv[1:])

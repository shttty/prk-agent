import os
import selectors
import socket
import struct
import time


class ForkserverStopRequests:
    def __init__(self, selector, listener, generation, capacity, timeout):
        self.selector, self.listener, self.generation = selector, listener, generation
        self.limit, self.timeout = 4 * capacity + 2, timeout
        self.peers = {}
        self.waiters = {}
        self.listener.setblocking(False)
        selector.register(listener, selectors.EVENT_READ)

    def close(self, peer):
        _, request = self.peers.pop(peer)
        if request is not None:
            del self.waiters[request[1]]
        self.selector.unregister(peer)
        peer.close()

    def reply(self, peer, cell_id, status):
        send_forkserver_packet(peer, self.generation, cell_id, status=status)
        self.close(peer)

    def receive(self, apply):
        # Read freshly accepted clients now, not in a later selector turn that
        # could first release a ready handshake.
        for peer in tuple(self.peers):
            self.read(peer, apply)
        for _ in range(self.limit):
            try:
                peer, _ = self.listener.accept()
            except BlockingIOError:
                break
            try:
                _, uid, _ = struct.unpack("3i", peer.getsockopt(socket.SOL_SOCKET, socket.SO_PEERCRED, struct.calcsize("3i")))
            except OSError:
                peer.close()
                continue
            if uid != os.geteuid() or len(self.peers) >= self.limit:
                peer.close()
                continue
            peer.setblocking(False)
            self.peers[peer] = time.monotonic() + self.timeout, None
            self.selector.register(peer, selectors.EVENT_READ)
            self.read(peer, apply)

    def read(self, peer, apply):
        _, request = self.peers[peer]
        try:
            if request is not None:
                # No second request on this connection. A hung-up waiter owns no slot.
                peer.recv(1, socket.MSG_PEEK)
                self.close(peer)
                return
            raw, _, flags, _ = peer.recvmsg(4096)
            if flags & (socket.MSG_TRUNC | socket.MSG_CTRUNC):
                raise ValueError("truncated forkserver stop request")
            kind, cell_id = parse_forkserver_request(raw, self.generation, ("cancel",), allow_retire=True)
            try:
                # A timed-out client may have sent a packet before we could
                # accept it (e.g. during preload). Do not reserve for that client.
                peer.recv(1, socket.MSG_PEEK)
            except BlockingIOError:
                pass
            else:
                self.close(peer)
                return
        except BlockingIOError:
            return
        except (OSError, ValueError, RecursionError):
            self.close(peer)
            return
        result = apply(kind, cell_id)
        if result is not None or cell_id in self.waiters:
            self.reply(peer, cell_id, result or "unconfirmed")
        else:
            self.waiters[cell_id] = peer
            self.peers[peer] = time.monotonic() + self.timeout, (kind, cell_id)

    def settle(self, proof, final):
        now = time.monotonic()
        for peer, (deadline, request) in tuple(self.peers.items()):
            if request is None:
                if now >= deadline:
                    self.close(peer)
                continue
            _, cell_id = request
            if proof(cell_id):
                self.reply(peer, cell_id, "reaped")
            elif final or now >= deadline:
                self.reply(peer, cell_id, "unconfirmed")

    def dispose(self):
        for peer in tuple(self.peers):
            self.close(peer)

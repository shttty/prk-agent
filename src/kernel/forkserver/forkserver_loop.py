import importlib
import selectors
import sys
import time


class Forkserver:
    def __init__(self, selector, control, listener, generation, capacity, timeout, wake):
        self.selector, self.control, self.generation = selector, control, generation
        self.capacity, self.timeout, self.wake = capacity, timeout, wake
        self.stop_requests = ForkserverStopRequests(selector, listener, generation, capacity, timeout)
        self.cells, self.leaders = {}, set()
        self.reserved = set()
        self.preload_failure = None
        self.fenced = self.terminated = False
        self.shutdown_at = None
        control.setblocking(False)
        selector.register(control, selectors.EVENT_READ)
        selector.register(wake, selectors.EVENT_READ)

    def preload(self, modules):
        for module in modules:
            if self.terminated:
                return
            try:
                importlib.import_module(module)
            except BaseException as error:
                reason = f"{module}: {type(error).__name__}: {error}"[:2048]
                self.preload_failure = (module[:2048], reason)
                print("PRK forkserver preload failed: " + reason, file=sys.stderr, flush=True)
                return

    def fence(self):
        if self.fenced:
            return
        self.fenced = True
        self.reserved.clear()
        for cell in self.cells.values():
            cell.cancel()

    def shutdown(self):
        if self.shutdown_at is None:
            self.fence()
            self.selector.unregister(self.control)
            self.control.close()
            self.shutdown_at = time.monotonic() + self.timeout / 2

    def stop_proved(self, cell_id):
        if cell_id is None:
            return all(cell.proved for cell in self.cells.values())
        cell = self.cells.get(cell_id)
        return cell is not None and cell.proved

    def request_stop(self, kind, cell_id):
        if kind == "retire":
            self.fence()
            return "reaped" if self.stop_proved(None) else None
        cell = self.cells.get(cell_id)
        if cell is not None:
            if cell.committed:
                return "finished"
            cell.cancel()
            return "reaped" if cell.proved else None
        if self.fenced:
            return "unconfirmed"
        if cell_id not in self.reserved and len(self.reserved) >= 4 * self.capacity:
            return "unconfirmed"
        self.reserved.add(cell_id)
        return "pending"

    def fork(self, cell_id, status, data):
        try:
            with data:
                if self.fenced or self.terminated:
                    reject_forkserver_cell(status, self.generation, cell_id, "forkserver is retired")
                    return
                if cell_id in self.reserved:
                    self.reserved.remove(cell_id)
                    send_forkserver_packet(status, self.generation, cell_id, kind="cancelled")
                    return
                if self.preload_failure:
                    module, reason = self.preload_failure
                    reject_forkserver_cell(status, self.generation, cell_id, reason, module=module)
                    return
                if len(self.cells) >= self.capacity:
                    # The runner closes the prior status before submitting a replacement.
                    # Observe that EOF even if its readiness raced this control packet.
                    for done_id, done in tuple(self.cells.items()):
                        if done.proved:
                            done.check_status_closed()
                            if done.status is None:
                                del self.cells[done_id]
                if len(self.cells) >= self.capacity or cell_id in self.cells:
                    send_forkserver_packet(status, self.generation, cell_id, kind="rejected", code="BUSY",
                                           reason="forkserver capacity or duplicate identity")
                    return
                try:
                    pid, handshake, threads = fork_child(data)
                except OSError as error:
                    reject_forkserver_cell(status, self.generation, cell_id, str(error))
                    return
            if pid is None:
                reject_forkserver_cell(status, self.generation, cell_id,
                                       "forkserver must have exactly one OS thread", threads)
                return
            self.leaders.add(pid)
            self.cells[cell_id] = ForkserverCell(self.selector, self.generation, cell_id, status, pid, handshake)
            status = None
        finally:
            if status is not None:
                status.close()

    def read_control(self):
        # The runner queues cancel under the same lock as fork sendmsg. Consume
        # queued control before releasing any child, even if its handshake is ready.
        for _ in range(4 * self.capacity + 2):
            if self.terminated:
                self.shutdown()
            if self.shutdown_at is not None:
                return True
            try:
                request = receive_forkserver_control(self.control, self.generation)
            except BlockingIOError:
                return True
            except (ValueError, RecursionError):
                continue
            except ConnectionResetError:
                request = None
            if request is None:
                self.shutdown()
                return True
            kind, cell_id, status, data = request
            if kind == "fork":
                self.fork(cell_id, status, data)
            else:
                self.reserved.discard(cell_id)
                cell = self.cells.get(cell_id)
                if cell is not None:
                    cell.cancel()
        return False

    def serve(self):
        try:
            while True:
                busy = self.stop_requests.peers or self.shutdown_at is not None or any(
                    cell.exit_code is not None and not cell.proved for cell in self.cells.values())
                self.selector.select(0.01 if busy else None)
                try:
                    self.wake.recv(4096)
                except BlockingIOError:
                    pass
                if self.terminated:
                    self.shutdown()
                self.stop_requests.receive(self.request_stop)
                drained = self.read_control()
                self.stop_requests.receive(self.request_stop)
                if self.terminated:
                    self.shutdown()
                if drained and any(cell.handshake is not None for cell in self.cells.values()):
                    # Recheck sources that became ready while the second drain was in progress.
                    for key, _ in self.selector.select(0):
                        peer = key.fileobj
                        if peer is self.control or peer is self.stop_requests.listener or peer in self.stop_requests.peers:
                            drained = False
                            break
                for cell in self.cells.values():
                    if self.terminated:
                        self.shutdown()
                    cell.receive_commit(self.fenced)
                    if cell.status is None and not cell.proved:
                        cell.cancel()
                    if drained:
                        cell.release()
                    cell.reap(self.leaders)
                expired = self.shutdown_at is not None and time.monotonic() >= self.shutdown_at
                self.stop_requests.settle(self.stop_proved, final=expired)
                for cell_id, cell in tuple(self.cells.items()):
                    if cell.status is None and cell.proved:
                        del self.cells[cell_id]
                if self.shutdown_at is not None and (expired or self.stop_proved(None)):
                    return
        finally:
            self.stop_requests.dispose()
            for cell in self.cells.values():
                cell.close_handshake()
                cell.close_status()

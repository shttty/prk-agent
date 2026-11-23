"""One new process, one owned client operation, one async injection."""
import errno
import json
import os
from pathlib import Path
import platform
import socket
import sys
import threading
import time

sys.path[:0] = [str(Path(__file__).resolve().parent), sys.argv[1]]
from a_net_endpoints import Endpoints
from a_net_scenarios import operation, prepare, paramiko, psycopg2, requests
from net_ladder import DIRECT, POLL, SELECT, SET_ASYNC, sample, socket_action, stat_socket, syn_sent


BLACKHOLE = ('10.255.255.1', 22)
PREFIXES = dict(http=b'GET / HTTP/1.1\r\n', tls_ssl=b'\x16\x03', tls_requests=b'\x16\x03',
                paramiko_banner=b'SSH-', pg_prehandshake=b'\x00\x03\x00\x00')


def wait_until(probe, timeout=.65):
    deadline = time.monotonic() + timeout
    while True:
        result = probe()
        if result or time.monotonic() >= deadline:
            return result
        time.sleep(.001)


def launch(name, port):
    if name == 'recv':
        with socket.create_connection(('127.0.0.1', port)) as conn:
            return conn.recv(1024)
    if name == 'paramiko_banner':
        client = paramiko.SSHClient()
        return client.connect('127.0.0.1', port=port, username='probe', password='probe',
                              look_for_keys=False, allow_agent=False)
    return operation(name, port)


def socket_peek(conn):
    try:
        return conn.recv(4096, socket.MSG_PEEK | socket.MSG_DONTWAIT)
    except BlockingIOError:
        return b''


def peer_after(peer, endpoint, name):
    if peer is None:
        return dict(state='no accepted peer (namespace drops SYNs)')
    if name == 'pg_query':
        def finished():
            with endpoint.lock:
                return next((e for e in endpoint.events if e['kind'] == 'pg_server_end'), None)
        event = wait_until(finished, .10)
        return dict(state='open' if not event else ('EOF' if event['error'] == 'EOFError()' else 'error'),
                    event=event)
    result = dict(state='open', bytes_hex='')

    def drain():
        try:
            data = peer.recv(4096, socket.MSG_DONTWAIT)
        except BlockingIOError:
            return False
        except OSError as exc:
            result.update(state='error', errno=exc.errno)
            return True
        if not data:
            result['state'] = 'EOF'
            return True
        result['bytes_hex'] += data.hex()
        return False

    wait_until(drain, .10)
    return result


def main(mode, name):
    assert platform.machine() == 'x86_64' and os.sched_getaffinity(0) == {0}
    endpoint = Endpoints()
    port = endpoint.tcp(name) if name in ('recv', 'paramiko_banner') else prepare(name, endpoint)
    mem = os.open('/proc/self/mem', os.O_RDONLY | os.O_CLOEXEC)
    old_fds = set()
    for fd in map(int, os.listdir('/proc/self/fd')):
        try:
            os.fstat(fd)
        except OSError as exc:
            if exc.errno != errno.EBADF:  # transient /proc/self/fd directory entry
                raise
        else:
            old_fds.add(fd)
    outcome = {}

    def invoke():
        try:
            result = launch(name, port)
            outcome.update(kind='returned', type=type(result).__name__)
        except BaseException as exc:
            outcome.update(kind='exception', type=type(exc).__name__, message=str(exc))
        outcome['body_finished_at'] = time.monotonic()

    thread = threading.Thread(target=invoke, name='net_target', daemon=True)
    thread.start()
    task = Path(f'/proc/self/task/{thread.native_id}')
    assert task.exists()
    peer = None
    pre_peer = dict(state='SYN blackhole')
    if port is not None:
        assert wait_until(lambda: len(endpoint.sockets) == 2)
        peer = endpoint.sockets[1]
        old_fds.add(peer.fileno())
        pre_peer = dict(state='accepted', local=peer.getsockname(), remote=peer.getpeername())
        if name in PREFIXES:
            data = wait_until(lambda: socket_peek(peer))
            assert PREFIXES[name] in data, (name, data)
            pre_peer.update(prefix_hex=data[:64].hex())
        if name == 'pg_query':
            def query_seen():
                with endpoint.lock:
                    return any(e.get('message_type') == 'Q' and
                               bytes.fromhex(e['body_hex']).startswith(b'SELECT 1') for e in endpoint.events)
            assert wait_until(query_seen)
            pre_peer.update(query_seen=True)
    # Give both paired samples the same wait before intervening. No peer closes.
    time.sleep(.15)
    before = sample(thread, mem)
    allowed = {202, 449} if name == 'paramiko_banner' else DIRECT.keys() | POLL.keys() | SELECT.keys()
    assert thread.is_alive() and before.get('nr') in allowed, (name, before, outcome)
    assert 'read_error' not in before, before
    if name != 'paramiko_banner':
        candidates = set(before['fds']) - old_fds
        assert len(candidates) == 1, (before, old_fds)
        if peer is None:
            pre_peer = syn_sent(stat_socket(candidates.pop())[1], BLACKHOLE)
    inject_at = time.monotonic()
    injected = SET_ASYNC(thread.ident, KeyboardInterrupt)
    assert injected == 1, injected
    first = sample(thread, mem)
    action = (socket_action(thread, first, mem, old_fds, peer, BLACKHOLE) if mode == 'ladder'
              else dict(status='async-only'))
    thread.join(.65)
    alive = thread.is_alive()
    assert alive or wait_until(lambda: not task.exists(), .02), (name, 'still a native task after join')
    native_gone_at = None if alive else time.monotonic()
    observed_ms = (time.monotonic() - inject_at) * 1000
    post = sample(thread, mem)
    observed_peer = peer_after(peer, endpoint, name)
    if not alive:
        assert post['raw'] == 'exited', post
    with endpoint.lock:
        events = list(endpoint.events)
    os.close(mem)
    print(json.dumps(dict(case=name, mode=mode, pid=os.getpid(), native_tid=thread.native_id,
                          thread_ident=thread.ident, python=sys.version.split()[0],
                          affinity=sorted(os.sched_getaffinity(0)),
                          dependencies=dict(requests=requests.__version__, paramiko=paramiko.__version__,
                                            psycopg2=psycopg2.__version__,
                                            libpq=psycopg2.extensions.libpq_version()),
                          before=before, inject_at=inject_at, injected=injected, post_inject=first,
                          action=action, alive_at_deadline=alive, observed_ms=observed_ms,
                          native_gone_at=native_gone_at, after=post, outcome=outcome.copy(),
                          peer_before=pre_peer, peer_after=observed_peer, endpoint_events=events)), flush=True)
    # The async control may still be blocked. Cleanup occurs only after logging.
    os._exit(0)


main(*sys.argv[2:])

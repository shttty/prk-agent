"""Throwaway Linux x86-64 socket stop probe; never acts on another process."""
import ctypes
import os
from pathlib import Path
import socket
import stat
import struct
import time


SET_ASYNC = ctypes.pythonapi.PyThreadState_SetAsyncExc
SET_ASYNC.argtypes = [ctypes.c_ulong, ctypes.py_object]
SET_ASYNC.restype = ctypes.c_int
DIRECT = {0: 'read', 42: 'connect', 45: 'recvfrom', 47: 'recvmsg'}
POLL = {7: 'poll', 271: 'ppoll'}
SELECT = {23: 'select', 270: 'pselect6'}
NAMES = {**DIRECT, **POLL, **SELECT, 202: 'futex', 449: 'futex_waitv'}
POLLFD = struct.Struct('=ihh')  # int fd; short events, revents


def sample(thread, mem):
    try:
        raw = Path(f'/proc/self/task/{thread.native_id}/syscall').read_text().strip()
    except (FileNotFoundError, ProcessLookupError):
        return dict(raw='exited')
    fields = raw.split()
    if len(fields) != 9 or fields[0] == '-1':
        return dict(raw=raw)
    nr = int(fields[0])
    args = tuple(int(field, 0) for field in fields[1:7])
    snap = dict(raw=raw, nr=nr, name=NAMES.get(nr, 'unsupported'), args=args, fds=[], sets={})

    def read(address, length):
        if not (0 < address < (1 << 63) and 0 < length <= 512):
            raise ValueError('memory read outside probe bounds')
        data = os.pread(mem, length, address)
        if len(data) != length:
            raise ValueError('short self memory read')
        return data

    try:
        if nr in DIRECT:
            snap['fds'] = [args[0]]
        elif nr in POLL:
            addr, n = args[:2]
            if not 0 < n <= 64:
                raise ValueError('requires 1–64 pollfd entries')
            poll = [(fd, events) for fd, events, _ in POLLFD.iter_unpack(read(addr, n * POLLFD.size))]
            snap['sets']['pollfd'] = poll
            snap['fds'] = sorted({fd for fd, _ in poll if fd >= 0})
        elif nr in SELECT:
            n = args[0]
            if not 0 < n <= 1024:
                raise ValueError('requires 1–1024 select bits')
            fds = set()
            for tag, address in zip(('read', 'write', 'exception'), args[1:4]):
                if address:
                    data = read(address, ((n + 63) // 64) * 8)
                    snap['sets'][tag] = data.hex()
                    fds.update(fd for fd in range(n) if data[fd // 8] & (1 << (fd % 8)))
            snap['fds'] = sorted(fds)
    except (OSError, ValueError) as exc:
        snap.update(fds=[], read_error=str(exc))
    return snap


def stat_socket(fd):
    s = os.fstat(fd)
    if not stat.S_ISSOCK(s.st_mode):
        raise ValueError(f'fd {fd} is not a socket')
    return (s.st_dev, s.st_ino)


def syn_sent(inode, remote):
    def addr(hex_pair):
        ip, port = hex_pair.split(':')
        return (socket.inet_ntoa(bytes.fromhex(ip)[::-1]), int(port, 16))

    for line in Path('/proc/self/net/tcp').read_text().splitlines()[1:]:
        fields = line.split()
        if int(fields[9]) == inode and addr(fields[2]) == remote and fields[3] == '02':
            return dict(state='SYN_SENT', local=addr(fields[1]), remote=remote, inode=inode)
    raise ValueError('socket is not the fixture SYN_SENT connection')


def socket_action(thread, first, mem, old_fds, peer, blackhole):
    record = dict(status='not-applicable')
    candidates = set(first.get('fds', ())) - old_fds
    if len(candidates) != 1:
        record['reason'] = first.get('read_error', 'no unique fixture fd in target syscall')
        return record
    n = record['N'] = candidates.pop()
    try:
        record['N_before'] = stat_socket(n)
        d = record['D'] = os.dup(n)
    except (OSError, ValueError) as exc:
        record.update(status='declined', reason=str(exc))
        return record
    try:
        second = record['reread'] = sample(thread, mem)
        keys = ('nr', 'args', 'sets', 'fds')
        if n not in second.get('fds', ()) or any(first[key] != second[key] for key in keys):
            raise ValueError('target syscall/sets changed after dup')
        record['N_after'], record['D_identity'] = stat_socket(n), stat_socket(d)
        if not record['N_before'] == record['N_after'] == record['D_identity']:
            raise ValueError('socket dev/inode changed')
        pinned = socket.socket(fileno=d)
        try:
            if peer is None:
                record['transport'] = syn_sent(record['D_identity'][1], blackhole)
            else:
                local, remote = pinned.getsockname(), pinned.getpeername()
                if (local, remote) != (peer.getpeername(), peer.getsockname()):
                    raise ValueError('pinned socket is not the client end of the fixture')
                record['transport'] = dict(state='established', local=local, remote=remote)
            record.update(status='attempted', shutdown_fd=d, shutdown_at=time.monotonic())
            try:
                pinned.shutdown(socket.SHUT_RDWR)
            except OSError as exc:
                record.update(shutdown_rc=-1, shutdown_errno=exc.errno, shutdown_error=str(exc))
            else:
                record.update(shutdown_rc=0, shutdown_errno=0)
            record['shutdown_returned_at'] = time.monotonic()
        finally:
            pinned.detach()
    except (OSError, ValueError) as exc:
        record.update(status='declined', reason=str(exc))
    finally:
        os.close(d)
        record['D_closed_at'] = time.monotonic()
    return record

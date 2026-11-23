"""Owned socketpairs only. Force close+reuse at exact protocol boundaries, no timing races needed."""
import json, os, pathlib, socket, stat, sys, threading, time

def ident(n):
    s=os.fstat(n); assert stat.S_ISSOCK(s.st_mode); return s.st_dev,s.st_ino

def trial(phase):
    old,peer=socket.socketpair(); new,other=socket.socketpair(); n=old.fileno(); read=[]
    def recv(): read.append(old.recv(1).hex())
    t=threading.Thread(target=recv); t.start(); path=pathlib.Path('/proc/self/task/%d/syscall'%t.native_id)
    deadline=time.monotonic()+2
    def snap(): return path.read_text().split()
    while time.monotonic()<deadline:
        a=snap()
        if a[0]=='45' and int(a[1],16)==n: break
        time.sleep(.002)
    else: raise RuntimeError('no blocking recvfrom')
    first=ident(n)
    def reuse(): os.dup2(new.fileno(),n,inheritable=False)
    if phase=='after_first_identity': reuse()
    d=os.dup(n); fixed=ident(d)
    if phase=='after_dup': reuse()
    b=snap(); current=ident(n); same_call=a==b; approved=same_call and first==current==fixed
    if phase=='after_check': reuse()
    try:
        if approved:
            assert fixed==first
            with socket.socket(fileno=d) as pinned: pinned.shutdown(socket.SHUT_RDWR)
        else:
            os.close(d); peer.sendall(b'X')
        t.join(1); assert not t.is_alive()
        other.sendall(b'Y'); assert old.recv(1)==b'Y'; old.sendall(b'Z'); assert other.recv(1)==b'Z'
        assert approved==(phase=='after_check') and read==([''] if approved else ['58'])
        return dict(phase=phase,fd=n,dup=d,same_syscall=same_call,first=first,pinned=fixed,validate=current,approved=approved,original_read=read[0],replacement_roundtrip=True)
    finally:
        for s in (old,peer,new,other): s.close()
assert os.sched_getaffinity(0)=={0}; print(json.dumps(dict(py=sys.version.split()[0],pid=os.getpid(),rows=[trial(p) for p in ('after_first_identity','after_dup','after_check')])))

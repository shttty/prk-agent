"""Decision probe. Dedicated, fresh exec 'server' owns every fork/wait. Trusted local primitive payloads only."""
import json, os, pathlib, pickle, signal, socket, struct, subprocess, sys, threading, time

def send(s,b): s.sendall(struct.pack('!I',len(b))+b)
def take(s,n):
    out=bytearray()
    while len(out)<n:
        p=s.recv(n-len(out)); assert p; out.extend(p)
    return bytes(out)
def recv(s): return take(s,struct.unpack('!I',take(s,4))[0])
def count(): return int(pathlib.Path('/proc/self/status').read_text().split('Threads:')[1].split()[0])
def server(fd):
    import numpy
    sock=socket.socket(fileno=int(fd)); parked=threading.Event()
    for cmd in ('sum','sleep','refuse'):
        payload=recv(sock)
        if cmd=='refuse': th=threading.Thread(target=parked.wait); th.start()
        n=count()
        if n!=1:
            send(sock,('refused Threads=%s'%n).encode()); parked.set(); th.join(); break
        pid=os.fork()
        if pid==0:
            os.setsid() # no user code before private PGID
            if cmd=='sleep': send(sock,b'group-ready'); time.sleep(60)
            else: send(sock,pickle.dumps(sum(pickle.loads(payload)['nums'])))
            os._exit(0)
        if cmd=='sleep':
            assert recv(sock)==b'cancel' and os.getpgid(pid)==pid; os.killpg(pid,signal.SIGKILL)
        _,status=os.waitpid(pid,0); send(sock,json.dumps([pid,n,status]).encode())
    sock.close()
if len(sys.argv)>1: server(sys.argv[1]); sys.exit()
s,t=socket.socketpair();s.settimeout(4)
env=dict(os.environ,OPENBLAS_NUM_THREADS='1',OMP_NUM_THREADS='1',MKL_NUM_THREADS='1',BLIS_NUM_THREADS='1')
p=subprocess.Popen([sys.executable,__file__,str(t.fileno())],env=env,pass_fds=[t.fileno()]); t.close()
try:
    nums=[20,22];send(s,pickle.dumps({'nums':nums})); value=pickle.loads(recv(s)); first=json.loads(recv(s)); assert value==42 and first[2]==0
    send(s,b'');assert recv(s)==b'group-ready'; start=time.monotonic_ns();send(s,b'cancel');second=json.loads(recv(s));dt=(time.monotonic_ns()-start)/1e6;assert os.WIFSIGNALED(second[2]) and os.WTERMSIG(second[2])==signal.SIGKILL
    send(s,b''); refused=recv(s).decode(); assert refused=='refused Threads=2'; assert p.wait(timeout=2)==0
    print(json.dumps(dict(python=sys.version.split()[0],preload='numpy',value=value,first=first,second=second,cancel_to_wait_ms=dt,refused=refused)))
finally:
    s.close()
    if p.poll() is None: p.terminate();p.wait(timeout=2)

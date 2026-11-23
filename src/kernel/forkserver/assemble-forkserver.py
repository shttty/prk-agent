import json
import os
import selectors
import signal
import socket
import sys




def run_forkserver():
    # Runner interrupts can hit our shared PGID. SIGTERM is a fenced shutdown;
    # use the wakeup fd so even an idle selector observes it promptly.
    signal.signal(signal.SIGINT, signal.SIG_IGN)
    try:
        fd, listen_fd, generation, capacity, timeout_ms, preload = sys.argv[1:]
        with socket.socket(fileno=int(fd)) as control, socket.socket(fileno=int(listen_fd)) as listener, \
                selectors.DefaultSelector() as selector:
            control.set_inheritable(False)
            listener.set_inheritable(False)
            wake, notify = socket.socketpair()
            with wake, notify:
                wake.setblocking(False)
                notify.setblocking(False)
                service = Forkserver(selector, control, listener, generation, int(capacity), float(timeout_ms) / 2000, wake)

                def terminate(_signum, _frame):
                    service.terminated = True

                signal.signal(signal.SIGTERM, terminate)
                signal.set_wakeup_fd(notify.fileno(), warn_on_full_buffer=False)
                try:
                    adopt_forkserver_descendants()
                    service.preload(json.loads(preload))
                    signal.signal(signal.SIGCHLD, lambda *_: None)  # Wake to reap without polling running cells.
                    service.serve()
                finally:
                    signal.set_wakeup_fd(-1)
    except (OSError, ValueError) as error:
        print("PRK forkserver unavailable: " + str(error), file=sys.stderr, flush=True)
        os._exit(1)
    # A preload may have started non-daemon threads. Only the selector owns shutdown.
    os._exit(0)


run_forkserver()

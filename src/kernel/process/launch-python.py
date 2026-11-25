import json
import os
import socket
import subprocess
import sys


def launch_python(configuration, source, forkserver_source):
    # This runs in the final scope, before loading the runner or starting any threads.
    control = service = None
    try:
        if sys.platform != "linux":
            raise OSError("forkserver requires Linux /proc")
        control, server = socket.socketpair(socket.AF_UNIX, socket.SOCK_SEQPACKET)
        with server, socket.socket(socket.AF_UNIX, socket.SOCK_SEQPACKET) as listener:
            # Bind before exec so cancellation can queue even during preload.
            listener.bind("\0prk-fork-" + configuration["generation"])
            listener.listen(4 * configuration["maxActiveCells"] + 2)
            env = dict(os.environ, OPENBLAS_NUM_THREADS="1", OMP_NUM_THREADS="1",
                       MKL_NUM_THREADS="1", BLIS_NUM_THREADS="1", NUMEXPR_NUM_THREADS="1",
                       VECLIB_MAXIMUM_THREADS="1")
            # Stable limits belong to the clean exec, never to the per-cell request.
            isolated = {key: configuration[key] for key in ("processWindow", "options")}
            forkserver_source = f"ISOLATED_CONFIGURATION = {isolated!r}\n\n" + forkserver_source
            service = subprocess.Popen(
                [sys.executable, "-u", "-c", forkserver_source, str(server.fileno()), str(listener.fileno()),
                 configuration["generation"], str(configuration["maxActiveCells"]),
                 str(configuration["options"]["closeTimeoutMs"]), json.dumps(configuration["forkserverPreload"])],
                pass_fds=(server.fileno(), listener.fileno()), env=env, stdin=subprocess.DEVNULL, stdout=sys.stderr,
            )
    except (OSError, ValueError) as error:
        if control is not None:
            control.close()
            control = None
        print("PRK forkserver unavailable: " + str(error), file=sys.stderr, flush=True)
    try:
        runner = {"__name__": "__main__", "forkserver": control, "forkserver_pid": service.pid if service is not None else None}
        exec(compile(source, "<PRK runner>", "exec"), runner)
        runner["run_kernel"](configuration)
    finally:
        if control is not None:
            # EOF must reach the service even if an ordinary thread cell copied the fd with fork.
            try:
                control.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
            control.close()
        if service is not None:
            try:
                service.wait(timeout=configuration["options"]["closeTimeoutMs"] / 2000)
            except subprocess.TimeoutExpired:
                # A stuck preload must not hold the runner open forever. Only our Popen child.
                service.kill()
                service.wait()

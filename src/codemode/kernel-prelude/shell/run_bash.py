import codecs as _codecs
import math as _math
import os as _os
import selectors as _selectors
import signal as _signal
import subprocess as _subprocess


def bash(command, timeout=None):
    """Run bash; return exit_code, raw stdout/stderr, duration_ms, timed_out and truncated=False.
    Use either bash() or model terminals (terminal_textsend), not both.

    Stdin is closed (/dev/null): commands that prompt for input read EOF;
    run those with terminal_textsend.
    """
    if timeout is not None and (not _math.isfinite(timeout) or timeout <= 0):
        raise ValueError("timeout must be a finite positive number of seconds")
    started = _time.monotonic()
    env = dict(_os.environ, DEBIAN_FRONTEND="noninteractive", PIP_NO_INPUT="1",
               PYTHONUNBUFFERED="1", GIT_TERMINAL_PROMPT="0")
    child = _subprocess.Popen(command, shell=True, executable="/bin/bash", env=env,
                              stdin=_subprocess.DEVNULL, stdout=_subprocess.PIPE,
                              stderr=_subprocess.PIPE, start_new_session=True)
    streams = {"stdout": [], "stderr": []}
    decoders = {name: _codecs.getincrementaldecoder("utf-8")("replace") for name in streams}
    timed_out = False
    exited_at = None
    last_data = started

    def kill_group():
        try:
            _os.killpg(child.pid, _signal.SIGKILL)
        except ProcessLookupError:
            pass

    def emit(name, data, final=False):
        text = decoders[name].decode(data, final=final)
        if text:
            streams[name].append(text)
            if _current_cell() is None:
                _write(name, text)
            else:
                # Live shell chunks remain UI progress, not duplicate model output.
                _display({"application/x-prk-progress+json": {"stream": name, "text": text}}, raw=True)

    try:
        with _selectors.DefaultSelector() as selector:
            for name in streams:
                pipe = getattr(child, name)
                _os.set_blocking(pipe.fileno(), False)
                selector.register(pipe, _selectors.EVENT_READ, name)
            while True:
                now = _time.monotonic()
                if child.poll() is not None and exited_at is None:
                    exited_at = now
                if exited_at is not None and (not selector.get_map() or now - max(exited_at, last_data) >= 0.1):
                    break
                if timeout is not None and not timed_out and now - started >= timeout:
                    timed_out = True
                    kill_group()
                for key, _ in selector.select(0.05):
                    data = _os.read(key.fd, 65536)
                    if data:
                        last_data = _time.monotonic()
                        emit(key.data, data)
                    else:
                        selector.unregister(key.fileobj)
            for name in streams:
                emit(name, b"", final=True)
    except BaseException:
        kill_group()
        raise
    finally:
        child.stdout.close()
        child.stderr.close()
        child.wait()
    return {"exit_code": child.returncode, "stdout": "".join(streams["stdout"]),
            "stderr": "".join(streams["stderr"]),
            "duration_ms": round((_time.monotonic() - started) * 1000), "timed_out": timed_out, "truncated": False}



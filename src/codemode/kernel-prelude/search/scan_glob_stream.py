import contextlib as _glob_contextlib
import tempfile as _glob_tempfile


@_glob_contextlib.contextmanager
def _glob_scan(command, path):
    with _glob_tempfile.TemporaryFile() as errors:
        child = _subprocess.Popen(command, cwd=path, stdin=_subprocess.DEVNULL,
                                  stdout=_subprocess.PIPE, stderr=errors)

        def records():
            pending = b""
            while True:
                chunk = child.stdout.read1(8192)
                if not chunk:
                    child.wait()
                    return
                pending += chunk
                while b"\0" in pending:
                    raw, _, pending = pending.partition(b"\0")
                    yield raw

        try:
            yield records()
        finally:
            stopped = child.poll() is None
            if stopped:
                child.kill()
            child.stdout.close()
            child.wait()
            errors.seek(0)
            diagnostic = errors.read(4096).decode("utf-8", "replace").strip()
            if diagnostic or (child.returncode not in (0, 1) and not stopped):
                raise RuntimeError(f"glob: rg exited {child.returncode}: {diagnostic}")



import json
import os
from pathlib import Path
import subprocess
import tempfile
from .decode_search_bytes import _event_bytes
from .validate_text_file import _text_file


def hits(command, state, context, limit):
    loaded = None
    valid = False
    last_match = 0
    with tempfile.TemporaryFile() as errors:
        child = subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=errors)
        assert child.stdout is not None
        try:
            for encoded in child.stdout:
                event = json.loads(encoded)
                if event["type"] not in ("match", "context"):
                    continue
                data = event["data"]
                current = Path(os.fsdecode(_event_bytes(data["path"]))).resolve()
                if state["limit_reached"] and current != loaded:
                    break
                if current != loaded:
                    loaded, valid = current, _text_file(current)
                if not valid:
                    continue
                number = data["line_number"]
                if state["limit_reached"] and number > last_match + context:
                    break
                matched = event["type"] == "match" and not state["limit_reached"]
                if matched:
                    state["matches"] += 1
                    last_match = number
                    state["limit_reached"] = state["matches"] >= limit
                # LF is the row separator; bare CR remains content. Remove
                # CR only as part of CRLF, and UTF-8 BOM only on the first row.
                raw = _event_bytes(data["lines"])
                if raw.endswith(b"\n"):
                    raw = raw[:-1]
                    if raw.endswith(b"\r"):
                        raw = raw[:-1]
                if number == 1:
                    raw = raw.removeprefix(b"\xef\xbb\xbf")
                yield {"path": str(current), "number": number,
                       "text": raw.decode("utf-8"), "match": matched}
            state["stopped"] = state["limit_reached"]
            if not state["stopped"]:
                child.wait()
        finally:
            if child.poll() is None:
                state["stopped"] = True
                child.kill()
            child.stdout.close()
            child.wait()
        errors.seek(0)
        diagnostic = errors.read(4096).decode("utf-8", "replace").strip()
        if diagnostic or (child.returncode not in (0, 1) and not state["stopped"]):
            raise RuntimeError(f"grep: rg exited {child.returncode}: {diagnostic}")

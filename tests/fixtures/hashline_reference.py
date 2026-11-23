"""Independent expected references for the salted-hashline contract tests."""
import hashlib
from pathlib import Path


def reference(path, number, text):
    return f"{number}#" + hashlib.blake2b((str(Path(path).resolve()) + "\0" + text).encode()).hexdigest()[:3]

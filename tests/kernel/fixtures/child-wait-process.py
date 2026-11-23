import os
import sys
import time
from pathlib import Path


parent, root, label, group, normal_exit = sys.argv[1:]
if group != "-":
    os.setpgid(0, int(group))
gate = Path(root) / label
pidfile = gate.with_suffix(".ready")
temporary = gate.with_suffix(".pid")
temporary.write_text(str(os.getpid()))
temporary.replace(pidfile)
deadline = time.monotonic() + 30
while not gate.with_suffix(".release").exists() and not Path("release-all").exists():
    if os.getppid() != int(parent) or time.monotonic() >= deadline:
        sys.exit(92)
    time.sleep(.01)
gate.with_suffix(".released").touch()
sys.exit(int(normal_exit))

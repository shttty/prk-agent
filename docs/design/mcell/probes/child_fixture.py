"""Private subprocess fixture: no descendants, no external resources."""
import os
import select
import sys

life, ready, drop_stdout = map(int, sys.argv[1:])
os.write(ready, str(os.getpid()).encode())
os.close(ready)
if drop_stdout >= 0:
    if not select.select([drop_stdout], [], [], 8)[0]:
        sys.exit(90)
    assert os.read(drop_stdout, 1) == b""
    os.close(drop_stdout)
    os.close(1)
if not select.select([life], [], [], 8)[0]:
    sys.exit(91)
assert os.read(life, 1) == b""

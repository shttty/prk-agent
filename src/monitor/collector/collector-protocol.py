# Target-channel monitor module. Python >= 3.6, stdlib only.
# Machine, directory, disk and diff payloads retain the monitor protocol fields;
# the runtime attaches mod to events and correlates returned diff replies.
import os
import subprocess
import sys
import time

MAX_FILES = 200                 # files listed per directory
MAX_UNTRACKED_BYTES = 1 << 20   # larger untracked files are listed but not line-counted
MAX_DIFF_BYTES = 256 * 1024
GIT_TIMEOUT_S = 20
EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904"

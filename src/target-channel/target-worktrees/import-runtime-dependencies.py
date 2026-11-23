import base64
import hashlib
import os
import re
import subprocess
import tempfile
from types import SimpleNamespace

PATCH_MAX_BYTES = 16 * 1024 * 1024
PATCH_CHUNK_BYTES = 192 * 1024

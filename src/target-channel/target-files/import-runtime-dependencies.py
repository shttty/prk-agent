"""Target-local UTF-8 file tools. Python >= 3.6, stdlib only."""
import codecs
import difflib
import errno
import hashlib
import json
import os
import re
import socket
import stat
import tempfile


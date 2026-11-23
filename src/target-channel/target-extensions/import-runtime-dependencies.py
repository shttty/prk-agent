"""Remote extension artifacts and scoped runtime IPC. Python >= 3.6, stdlib only."""
import base64
import codecs
import hashlib
import json
import os
import platform
import queue
import re
import shutil
import signal
import socket
import subprocess
import sys
import tarfile
import tempfile
import threading
import time
import uuid



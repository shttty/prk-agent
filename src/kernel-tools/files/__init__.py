"""Kernel file tools; only displayed references authorize edits in this module instance."""
from .file_config import DEFAULT_CONFIG
from .file_state import _ctx
from .assemble_files import assemble_files as _assemble_files

_assemble_files(_ctx)

from .read import read
from .edit import edit
from .write import write
from .grep import grep

__all__ = ["read", "edit", "write", "grep"]

"""Stdlib-only path-salted line references and caller-owned sparse display state.

References are coordinates, not allocated identities. Only returned rows authorize
editing; translated rows use their new coordinates, without old-coordinate aliases.
"""

from .assemble_error import HashlineError
from .assemble_session import Session

__all__ = ["Session", "HashlineError"]



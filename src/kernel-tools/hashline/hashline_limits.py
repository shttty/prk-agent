import codecs
import re


_ROWS = 2000
_BYTES = 50 * 1024
_BUDGET = _BYTES - 1024
_PREVIEW = 48 * 1024
_CHUNK = 8192
_REF = re.compile(r"([1-9][0-9]*)#([0-9a-f]{3})\Z")
_BOM = codecs.BOM_UTF8
_IMAGE_BYTES = 20 * 1024 * 1024
_SNIFF_BYTES = 4100

import struct

_PNG = b"\x89PNG\r\n\x1a\n"
_BMP_HEADERS = frozenset((12, 40, 52, 56, 108, 124))


def _is_apng(header: bytes) -> bool:
    offset = len(_PNG)
    while offset + 8 <= len(header):
        length = struct.unpack_from(">I", header, offset)[0]
        tag = header[offset + 4 : offset + 8]
        if tag == b"acTL":
            return True
        if tag in (b"IDAT", b"IEND"):
            return False
        offset += 12 + length
    return False


def _is_bmp(header: bytes) -> bool:
    if len(header) < 26 or not header.startswith(b"BM"):
        return False
    file_size, _, _, pixel_offset, dib_size = struct.unpack_from("<IHHII", header, 2)
    if file_size < 26 or dib_size not in _BMP_HEADERS or pixel_offset < 14 + dib_size:
        return False
    if dib_size == 12:
        width, height = struct.unpack_from("<HH", header, 18)
        return width > 0 and height > 0
    width, height = struct.unpack_from("<ii", header, 18)
    return width > 0 and height != 0


def _detect_image_mime(header: bytes):
    if len(header) >= 4 and header[:3] == b"\xff\xd8\xff":
        return None if header[3] == 0xF7 else "image/jpeg"
    if len(header) >= 16 and header.startswith(_PNG):
        ihdr_len = struct.unpack_from(">I", header, 8)[0]
        if ihdr_len == 13 and header[12:16] == b"IHDR" and not _is_apng(header):
            return "image/png"
        return None
    if header.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    if len(header) >= 12 and header[:4] == b"RIFF" and header[8:12] == b"WEBP":
        return "image/webp"
    if _is_bmp(header):
        return "image/bmp"
    return None

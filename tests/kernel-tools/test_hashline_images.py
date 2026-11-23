"""Image detection and 20 MiB cap checks for PRK hashline read()."""

from pathlib import Path
import struct
import sys
import tempfile
import unittest
import zlib

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src" / "kernel-tools"))
from hashline import Session as HashlineSession


def png_chunk(tag: bytes, body: bytes) -> bytes:
    return struct.pack(">I", len(body)) + tag + body + struct.pack(">I", zlib.crc32(tag + body) & 0xFFFFFFFF)


def make_png(apng: bool = False) -> bytes:
    ihdr = struct.pack(">IIBBBBB", 2, 2, 8, 2, 0, 0, 0)
    chunks = [png_chunk(b"IHDR", ihdr)]
    if apng:
        chunks.append(png_chunk(b"acTL", struct.pack(">II", 2, 0)))
    chunks.append(png_chunk(b"IDAT", zlib.compress(b"\x00\x11\x22\x33\x44\x55\x66" * 2)))
    chunks.append(png_chunk(b"IEND", b""))
    return b"\x89PNG\r\n\x1a\n" + b"".join(chunks)


def make_bmp() -> bytes:
    pixel = b"\x00" * 16
    size = 54 + len(pixel)
    return b"BM" + struct.pack("<IHHI", size, 0, 0, 54) + struct.pack("<IIIHHIIIIII", 40, 2, 2, 1, 24, 0, len(pixel), 0, 0, 0, 0) + pixel


class HashlineImagesTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.calls = []
        self.session = HashlineSession(execute=lambda name, args: (self.calls.append((name, args)), {"content": [], "details": {}})[1])

    def write(self, name: str, payload: bytes) -> Path:
        target = self.root / name
        target.write_bytes(payload)
        return target

    def test_supported_image_headers_return_image_result_and_fire_read_hook(self):
        cases = [
            ("sample 1.png", make_png(), "image/png"),
            ("sample.jpg", b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9", "image/jpeg"),
            ("sample.gif", b"GIF89a\x01\x00\x01\x00\x00\x00\x00;", "image/gif"),
            ("sample.webp", b"RIFF\x10\x00\x00\x00WEBPVP8 \x04\x00\x00\x00\x00\x00\x00\x00", "image/webp"),
            ("sample.bmp", make_bmp(), "image/bmp"),
        ]
        for filename, data, expected_mime in cases:
            path = self.write(filename, data)
            result = self.session.read(path)
            self.assertEqual(result["mime_type"], expected_mime)
            self.assertEqual(result["lines"], [])
            self.assertIn(f"Read image file [{expected_mime}]", str(result))
        self.assertEqual(len(self.calls), len(cases))

    def test_non_image_binaries_and_apng_still_reject(self):
        with self.assertRaisesRegex(ValueError, "UTF-8 text required"):
            self.session.read(self.write("raw.bin", b"abc\x00def"))
        with self.assertRaises(ValueError):
            self.session.read(self.write("anim.png", make_png(apng=True)))

    def test_oversized_image_fails_before_full_read(self):
        huge = self.root / "huge.png"
        with huge.open("wb") as handle:
            handle.write(make_png())
            handle.truncate(20 * 1024 * 1024 + 1)
        with self.assertRaisesRegex(ValueError, "20 MiB"):
            self.session.read(huge)


if __name__ == "__main__":
    unittest.main()

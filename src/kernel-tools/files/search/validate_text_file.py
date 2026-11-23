import codecs


def _text_file(path):
    # rg can emit a match before finding a late NUL. Validate without retaining
    # the file or creating a full-file line table; binary files authorize no refs.
    decoder = codecs.getincrementaldecoder("utf-8-sig")("strict")
    with path.open("rb") as source:
        first = True
        while chunk := source.read(65536):
            if b"\x00" in chunk or (first and chunk.startswith((b"\xff\xfe", b"\xfe\xff", b"\x00\x00\xfe\xff"))):
                return False
            decoder.decode(chunk)
            first = False
        decoder.decode(b"", final=True)
    return True

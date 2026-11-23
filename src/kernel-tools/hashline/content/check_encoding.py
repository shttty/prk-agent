import codecs


def _check_encoding(data):
    if data.startswith((codecs.BOM_UTF16_LE, codecs.BOM_UTF16_BE,
                        codecs.BOM_UTF32_LE, codecs.BOM_UTF32_BE)) or b"\0" in data:
        raise ValueError("UTF-8 text required; binary/NUL and UTF-16/32 are unsupported")

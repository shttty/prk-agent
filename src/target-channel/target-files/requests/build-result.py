def _result(text, details):
    result = {"content": [{"type": "text", "text": text}], "details": details}
    if _json_bytes(result) > MAX_RESULT_BYTES:
        raise ValueError("File tool result exceeds 256 KiB; nothing written")
    return result



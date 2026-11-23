def asset_sha(value):
    if not isinstance(value, str) or re.fullmatch(r"[a-fA-F0-9]{64}", value) is None:
        raise ValueError("asset sha256 must contain 64 hexadecimal characters")
    return value.lower()



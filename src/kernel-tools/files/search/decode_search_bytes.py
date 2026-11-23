import base64


def _event_bytes(value):
    return value["text"].encode("utf-8") if "text" in value else base64.b64decode(value["bytes"])

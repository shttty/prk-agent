NUMBER = re.compile(r"[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?")


def parse_value(output, parser):
    text = output.decode("utf-8", "replace")
    if parser == "number":
        match = NUMBER.search(text)
        if match is None:
            raise ValueError("output contains no number")
        value = float(match.group())
    else:
        value = json.loads(text)
        for part in parser[5:].split("."):
            if isinstance(value, list):
                if re.fullmatch(r"[0-9]+", part) is None:
                    raise ValueError("JSON array path requires an unsigned index")
                value = value[int(part)]
            else:
                value = value[part]
    if type(value) not in (int, float) or not math.isfinite(value):
        raise ValueError("metric value must be a finite number")
    return value



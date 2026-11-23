def _lines(text):
    # splitlines() also treats bare CR and Unicode separators as line endings.
    return re.findall(r"[^\n]*\n|[^\n]+$", text)



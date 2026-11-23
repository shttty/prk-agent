def _ref(number, digest):
    return f"{number}#{digest >> 52:03x}"

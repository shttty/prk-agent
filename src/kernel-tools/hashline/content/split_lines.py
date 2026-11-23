def _split(text):
    # str.splitlines() also splits bare CR, which is file content here.
    pieces = text.split("\n")
    lines = [piece + "\n" for piece in pieces[:-1]]
    if pieces[-1] or not lines:
        lines.append(pieces[-1])
    return lines

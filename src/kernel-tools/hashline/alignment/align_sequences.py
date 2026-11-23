import difflib


def _opcodes(old, current):
    head = 0
    while head < min(len(old), len(current)) and old[head] == current[head]:
        head += 1
    tail = 0
    while tail < min(len(old), len(current)) - head and old[-1 - tail] == current[-1 - tail]:
        tail += 1
    old_end, current_end = len(old) - tail, len(current) - tail
    if head:
        yield "equal", 0, head, 0, head
    for tag, a, b, c, d in difflib.SequenceMatcher(
            None, old[head:old_end], current[head:current_end], autojunk=False).get_opcodes():
        yield tag, a + head, b + head, c + head, d + head
    if tail:
        yield "equal", old_end, len(old), current_end, len(current)

from ..references.hash_current_line import current_hash
from ..replacements.reject_edit import refuse
from .align_sequences import _opcodes
from .check_unique_alignment import _unique


def align_references(ctx, required):
    mapping = {number: number for number in required if current_hash(ctx, number) == ctx.previous[number]}
    windows = []
    for number in sorted(ctx.previous):
        if not windows or number != windows[-1][1] + 1:
            windows.append([number, number])
        else:
            windows[-1][1] = number
    moved, aligned_windows = set(), []
    for low, high in windows:
        needed = {number for number in required if low <= number <= high}
        # Freshly displayed coordinates are authoritative when every used
        # full hash still matches; stale neighboring views cannot override them.
        if not needed or all(number in mapping for number in needed):
            continue
        first, last = max(1, low - ctx.session.align_window), min(len(ctx.lines), high + ctx.session.align_window)
        old = [ctx.previous[number] for number in range(low, high + 1)]
        current = [current_hash(ctx, number) for number in range(first, last + 1)]
        positions = {}
        for index, digest in enumerate(current):
            positions.setdefault(digest, []).append(index)
        aligned = {}
        support_spans = {}
        for tag, a, b, c, d in _opcodes(old, current):
            if tag != "equal":
                continue
            for index in range(a, b):
                target = c + index - a
                if abs(first + target - (low + index)) > ctx.session.align_window:
                    continue
                if low + index in needed:
                    candidates = [candidate for candidate in positions[old[index]]
                                  if abs(first + candidate - (low + index)) <= ctx.session.align_window]
                    if not _unique(old, current, index, target, candidates, support_spans):
                        continue
                aligned[low + index] = first + target
        for number in needed:
            if number not in aligned:
                refuse(ctx, "Changed, deleted, out-of-window or ambiguous reference", number)
        mapping.update({number: aligned[number] for number in needed})
        moved.update(range(low, high + 1))
        aligned_windows.append(aligned)
    if len(set(mapping.values())) != len(mapping):
        refuse(ctx, "Ambiguous reference mapping", min(required))
    return mapping, moved, aligned_windows

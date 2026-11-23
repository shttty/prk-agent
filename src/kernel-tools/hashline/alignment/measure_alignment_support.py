def support(old, current, index, spans, target):
    # A maximal equal run has the same support at every point on its
    # diagonal. Keep its latest span, avoiding cubic work on repeated rows.
    diagonal = target - index
    span = spans.get(diagonal)
    if span is not None and span[0] <= index < span[1]:
        return span[1] - span[0]
    left = 0
    while index - left > 0 and target - left > 0 and old[index - left - 1] == current[target - left - 1]:
        left += 1
    right = 0
    while (index + right + 1 < len(old) and target + right + 1 < len(current)
           and old[index + right + 1] == current[target + right + 1]):
        right += 1
    spans[diagonal] = (index - left, index + right + 1)
    return left + right + 1

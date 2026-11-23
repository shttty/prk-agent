from .measure_alignment_support import support


def _unique(old, current, index, mapped, candidates, spans):
    """Reject tied/stronger duplicate contiguous context, not just matcher ties."""

    if len(candidates) == 1:
        return True
    score = support(old, current, index, spans, mapped)
    return all(candidate == mapped or support(old, current, index, spans, candidate) < score for candidate in candidates)

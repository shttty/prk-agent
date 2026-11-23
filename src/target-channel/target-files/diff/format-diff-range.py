def _range(start, end):
    count = end - start
    if count == 1:
        return str(start + 1)
    return str(start if count == 0 else start + 1) + "," + str(count)



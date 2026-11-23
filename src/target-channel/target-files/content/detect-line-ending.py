def _ending(value):
    index = value.find("\n")
    return "\r\n" if index > 0 and value[index - 1] == "\r" else "\n"



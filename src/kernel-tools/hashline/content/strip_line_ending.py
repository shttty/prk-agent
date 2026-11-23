def _logical(line):
    return line[:-2] if line.endswith("\r\n") else line[:-1] if line.endswith("\n") else line

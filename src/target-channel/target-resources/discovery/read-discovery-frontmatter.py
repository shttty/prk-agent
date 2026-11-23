def frontmatter(path):
    with open(path, "r", encoding="utf-8-sig", errors="replace") as source:
        first = source.readline()
        if not first.startswith("---"):
            return ""
        lines = [first]
        for line in source:
            if line.startswith("---"):
                return "".join(lines) + "---\n"
            lines.append(line)
    raise ValueError("frontmatter has no closing delimiter")



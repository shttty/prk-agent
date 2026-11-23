def _render(row):
    if row["omitted"]:
        text = f"[{row['bytes']} bytes not shown; replace the whole line to edit.]"
    else:
        text = row["text"]
        if row.get("omitted_chars"):
            text += f" …[+{row['omitted_chars']} chars]"
    prefix = row.get("kind", ">" if row.get("match") else "")
    return f"{prefix}{row['ref']}│{text}"

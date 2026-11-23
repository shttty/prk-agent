def _namespace_publish(_result=None):
    cell = _current_cell()
    state = _ns_state
    with state.lock:
        state.captured += 1
        revision = state.captured
        snapshot = _namespace.copy()

    # Signature and docstring inspection may run user code. Do it before locking publication.
    bindings, entries = {}, {}
    for name, value in snapshot.items():
        if not _namespace_user_name(name):
            continue
        name = str.__str__(name)
        entries[name] = _namespace_descriptor(name, value)
        # Compare identity without invoking a metaclass's equality method.
        bindings[name] = (id(value), id(type(value)))

    with state.lock:
        if revision < state.published:
            # A later snapshot overtook this one during inspection. Do not roll it back.
            summary = _namespace_summary(state.entries)
        else:
            origin = getattr(cell, "prelude_origin", None) if cell is not None and not cell.overlapped else None
            if origin is not None:
                origin = origin.copy()
            added, modified, deleted = [], [], []
            origins = {}
            for name, binding in bindings.items():
                if binding == state.bindings.get(name):
                    # In-place mutation deliberately leaves the binding's known origin unchanged.
                    if name in state.origins:
                        origins[name] = state.origins[name]
                elif origin is not None:
                    changes = modified if name in state.bindings else added
                    changes.append(name)
                    origins[name] = origin
                if name in origins:
                    entries[name]["origin"] = origins[name]
            if origin is not None:
                deleted = sorted(state.bindings.keys() - bindings.keys())
            summary = _namespace_summary(entries, added, modified, deleted)
            state.published = revision
            state.bindings, state.origins, state.entries = bindings, origins, entries
        _display({"application/x-prk-namespace+json": summary}, raw=True)


def _namespace_summary(entries, added=(), modified=(), deleted=()):
    summary = {"variables": [], "added": [], "modified": [], "deleted": [], "truncated": False}
    # Bound each list's entry count and their combined serialized payload; changes get priority.
    for field, names in (("added", added), ("modified", modified), ("deleted", deleted), ("variables", sorted(entries))):
        for name in names:
            if len(summary[field]) >= _ns_options["maxEntries"]:
                summary["truncated"] = True
                break
            summary[field].append(name if field == "deleted" else entries[name])
            if len(_json.dumps(summary, ensure_ascii=True, separators=(",", ":"))) > _ns_options["maxChars"]:
                summary[field].pop()
                summary["truncated"] = True
                break
    return summary



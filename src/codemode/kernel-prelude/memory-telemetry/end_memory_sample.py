def _memory_cell_end(_result=None):
    cell = _current_cell()
    if cell is None:
        return
    with _memory_lock:
        _memory_active.discard(cell.id)
    _memory_publish(cell_end=True)



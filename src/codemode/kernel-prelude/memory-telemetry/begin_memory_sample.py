def _memory_cell_start(_info=None):
    cell = _current_cell()
    if cell is not None:
        with _memory_lock:
            _memory_active.add(cell.id)



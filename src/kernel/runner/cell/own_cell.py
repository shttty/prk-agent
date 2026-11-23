import asyncio
import threading
from contextlib import contextmanager


class RunnerCell:
    def __init__(self, message):
        self.message = message
        self.id = message["cellId"]
        self.overlapped = False
        self.owner = None
        self.cancelled = False
        self.request_id = 0
        self.callback_id = None
        self.callback_reply = None
        self.callback_waiter = None
        self.reply_chunks = bytearray()
        self.image_count = self.image_bytes = 0
        self.worker = None
        self.user_thread = None
        self.waited_child_pidfd = None
        self.private_task = None
        self.async_code = None
        self.shared_task = None


def current_cell(ctx):
    cell = ctx.ownership.get()
    if cell is None or cell.owner is not threading.current_thread():
        return None
    if cell.shared_task is not None and asyncio.current_task(loop=ctx.loop) is not cell.shared_task:
        return None
    return cell


@contextmanager
def own_cell(ctx, cell):
    token = ctx.ownership.set(cell)
    cell.owner = threading.current_thread()
    try:
        yield
    finally:
        cell.owner = None
        ctx.ownership.reset(token)

import codecs
import os
import selectors
import sys
import threading


def capture_output(ctx):
    """Keep the protocol descriptor private from fd 1/2 and inherited children."""
    ctx.protocol_fd = os.dup(1)
    os.set_inheritable(ctx.protocol_fd, False)
    selector = selectors.DefaultSelector()
    decoders = {}
    for fd, name in ((1, "stdout"), (2, "stderr")):
        read_fd, write_fd = os.pipe()
        os.dup2(write_fd, fd)
        os.close(write_fd)
        os.set_blocking(read_fd, False)
        selector.register(read_fd, selectors.EVENT_READ, name)
        decoders[name] = codecs.getincrementaldecoder("utf-8")("replace")
    sys.stdout.reconfigure(line_buffering=True, write_through=True)
    sys.stderr.reconfigure(line_buffering=True, write_through=True)
    ctx.stdout, ctx.stderr = sys.stdout, sys.stderr

    def drain(key):
        while True:
            try:
                data = os.read(key.fd, ctx.options["chunkBytes"])
            except BlockingIOError:
                return
            if not data:
                if text := decoders[key.data].decode(b"", final=True):
                    emit_message(ctx, "diagnostic", stream=key.data, text=text)
                selector.unregister(key.fd)
                os.close(key.fd)
                return
            text = decoders[key.data].decode(data)
            if text:
                emit_message(ctx, "diagnostic", stream=key.data, text=text)

    def consume():
        while True:
            for key, _ in selector.select():
                drain(key)

    threading.Thread(target=consume, name="prk-output", daemon=True).start()

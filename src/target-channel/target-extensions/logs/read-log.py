def read_log(ctx, stream, source):
    decoder = codecs.getincrementaldecoder("utf-8")("replace")
    try:
        while True:
            chunk = source.read(65536)
            if not chunk:
                break
            publish_log(ctx, stream, decoder.decode(chunk))
        publish_log(ctx, stream, decoder.decode(b"", final=True))
    except OSError:
        pass
    finally:
        source.close()


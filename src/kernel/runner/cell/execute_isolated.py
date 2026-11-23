from itertools import chain
import keyword
import sys
import unicodedata


def _isolated_input_values(ctx, message):
    names = message.get("inputs", [])
    output = message.get("outputs")
    if not isinstance(names, list) or ("outputs" in message and not isinstance(output, str)):
        raise ValueError("inputs must be a list of names; outputs must be a name")
    prelude = sys.modules.get("_prk_codemode")
    for name in chain(names, () if output is None else (output,)):
        if not isinstance(name, str):
            raise ValueError("Isolated variable names must be strings")
        if (not name.isidentifier() or keyword.iskeyword(name)
                or unicodedata.normalize("NFKC", name) != name
                or prelude is None or not prelude._namespace_user_name(name)):
            raise ValueError("Invalid isolated variable name: " + repr(name[:240]))
    try:
        return {name: ctx.namespace[name] for name in names}
    except KeyError as error:
        raise ValueError("Missing isolated input: " + repr(error.args[0])[:240]) from error


def _prepare_isolated(ctx, cell, transport, source, inputs):
    transport.await_fork()
    check_cancelled(ctx, cell)
    transport.stream.send_bytes(source)
    transport.stream.send_bytes(inputs)
    raw = transport.receive(ctx.limits["maxFrameBytes"], preparing=True)
    if raw is None:
        raise OSError(f"Isolated child exited before readiness ({transport.exit_code})")
    message = _isolated_frame(raw)
    if (message.keys() == {"kind", "code", "reason"} and message["kind"] == "rejected"
            and message["code"] in ("INVALID_REQUEST", "ISOLATED_INPUT")
            and isinstance(message["reason"], str)):
        transport.await_exit(preparing=True)
        raise _IsolatedRejection(message["code"], message["reason"])
    if message != {"kind": "ready"} or transport.exit_code is not None:
        raise ValueError("Invalid isolated child readiness frame")


def _isolated_return_text(ctx, message):
    # Budget for astral characters in the Gateway's UTF-16 output limit.
    limit = ctx.options["maxOutputChars"] // 2
    kind = message["type"]
    label = "Return (" + kind[:128] + "): "
    text = message["text"]
    marker = " …[truncated]"
    if not message["truncated"] and len(kind) <= 128 and len(label) + len(text) + 1 <= limit:
        return label + text + "\n"
    label = label[:max(0, limit - len(marker) - 1)]
    return (label + text[:max(0, limit - len(label) - len(marker) - 1)] + marker + "\n")[:limit]


def _isolated_exception_text(error):
    name = type(error).__name__
    try:
        return f"{name}: {str(error)[:640]}"
    except BaseException:
        return name


def execute_isolated(ctx, cell):
    try:
        values = _isolated_input_values(ctx, cell.message)
    except ValueError as error:
        return _isolated_rejection("INVALID_REQUEST", str(error))
    try:
        inputs = pickle_cell_values(values, ctx.limits["maxBytes"])
    except BaseException as error:
        check_cancelled(ctx, cell)
        return _isolated_rejection("ISOLATED_INPUT", "Could not serialize isolated inputs: " + _isolated_exception_text(error))
    # A validation or serialization failure above allocates no IPC and cannot admit or yield.
    check_cancelled(ctx, cell)
    source = cell.message["code"].encode()
    if len(source) > ctx.limits["maxFrameBytes"]:
        return _isolated_rejection("INVALID_REQUEST", "Isolated source exceeds process frame budget")
    admitted = False
    try:
        with open_isolated_transport(ctx, cell) as transport:
            _prepare_isolated(ctx, cell, transport, source, inputs)
            with execution_scope(ctx, cell, "isolated"):
                admitted = True
                check_cancelled(ctx, cell)
                transport.stream.send_bytes(b"run")
                result, serialized = relay_isolated_cell(ctx, cell, transport)
                if result["kind"] == "error":
                    check_cancelled(ctx, cell)
                    emit_stream(ctx, "stderr", f"{result['name']}: {result['message']}\n", cell.id)
                    return "cell_end", {"outcome": "error"}
            return _restore_isolated_result(ctx, cell, transport, serialized, result)
    except _IsolatedRejection as error:
        check_cancelled(ctx, cell)
        return _isolated_rejection(error.code, str(error))
    except (EOFError, OSError, ValueError) as error:
        # Preparation failures without a fork receipt aren't proof of cancellation.
        if not admitted:
            return _isolated_rejection("ISOLATION_UNAVAILABLE", str(error))
        check_cancelled(ctx, cell)
        raise


def _restore_isolated_result(ctx, cell, transport, serialized, result):
    check_cancelled(ctx, cell)
    # Decode only after waitpid proved a zero exit. Custom reducers are trusted
    # local code, not eligible for the child application's forwarded SDK scope.
    try:
        value = unpickle_cell_values(serialized)
    except BaseException as error:
        check_cancelled(ctx, cell)
        emit_stream(ctx, "stderr", "Could not restore isolated return: " + _isolated_exception_text(error) + "\n", cell.id)
        return "cell_end", {"outcome": "error"}
    check_cancelled(ctx, cell)
    # A stop can arrive after the child exits, including during the local decode.
    if not transport.commit():
        raise KeyboardInterrupt()
    return "cell_end", {"outcome": "ok", "isolated_return": (
        cell.message.get("outputs"), value, _isolated_return_text(ctx, result), transport.status.dup(),
    )}

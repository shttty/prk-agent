import sys
from contextlib import contextmanager


def check_cancelled(ctx, cell):
    with ctx.condition:
        if cell.cancelled or ctx.eof:
            raise KeyboardInterrupt()


@contextmanager
def execution_scope(ctx, cell, mode):
    with own_cell(ctx, cell):
        if mode == "isolated":
            # The child owns its figures, prelude and execution state, not the main namespace.
            with ctx.condition:
                check_cancelled(ctx, cell)
                emit_message(ctx, "cell_admitted", re=cell.message["id"], mode=mode)
            yield
            return
        with ctx.start_gate:
            with ctx.condition:
                check_cancelled(ctx, cell)
                emit_message(ctx, "cell_admitted", re=cell.message["id"], mode=mode)
            for peer in ctx.executing:
                cell.overlapped = peer.overlapped = True
            ctx.executing.add(cell)
        prelude = sys.modules.get("__prk__")
        tracing = sampling = succeeded = False
        try:
            if prelude:
                prelude.begin_cell(cell.message["title"])
                tracing = True
                prelude._trace.start()
                if prelude._memory_state is not None:
                    sampling = True
                    prelude._memory_cell_start()
            yield
            succeeded = True
        finally:
            def publish():
                if prelude:
                    try:
                        prelude._report_shadowed_aliases()
                        if tracing:
                            prelude._trace.stop()
                    finally:
                        try:
                            prelude._namespace_publish()
                        finally:
                            if sampling:
                                prelude._memory_cell_end()

            # The start gate is separate from intake. A solo cell must remain
            # solo through sweep/publication, or its overlap status would lie.
            with ctx.start_gate:
                overlapped = cell.overlapped
                if not overlapped:
                    try:
                        try:
                            if succeeded:
                                collect_figures(ctx)
                        finally:
                            publish()
                    finally:
                        ctx.executing.remove(cell)
            if overlapped:
                try:
                    publish()
                finally:
                    with ctx.start_gate:
                        ctx.executing.remove(cell)

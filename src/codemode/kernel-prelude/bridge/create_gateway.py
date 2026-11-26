def _create_gateway(callback, async_method=None):
    class _Gateway:
        def __getattr__(self, name):
            return lambda **args: self.call(name, args)

        def call(ctx, name, args=None):
            return callback("gateway", {"name": name, "args": args or {}})

        def describe(ctx, name=None):
            """gateway.describe() lists every callable Gateway tool as [{name, description}]; gateway.describe(name) returns that tool's Python stub as text, with its TypedDicts and guidelines.

            The list holds only the first paragraph of each description and includes the tools the prompt catalog leaves out.
            """
            return callback("describe", {"name": name})

        def search(ctx, query, limit=8):
            """Find callable Gateway tools by what you want to do: returns up to limit matches, best first, as [{name, description, stub}].

            Ranks every callable tool, listed in the prompt catalog or not, with BM25 over its name, description and argument names; query terms are words,
            not regular expressions. Each stub is the tool's Python signature, so a match can be called as gateway.<name>(**args) right away.
            """
            return callback("describe", {"query": query, "limit": limit})

    if async_method is not None:
        _Gateway.call_async = async_method
    return _Gateway()

def _create_gateway(callback, async_method=None):
    class _Gateway:
        def __getattr__(self, name):
            return lambda **args: self.call(name, args)

        def call(ctx, name, args=None):
            return callback("gateway", {"name": name, "args": args or {}})

        def describe(ctx, name=None):
            """No name: [{name, description}] of every callable Gateway tool. With name: {name, description, parameters, outputSchema?}."""
            return callback("describe", {"name": name})

    if async_method is not None:
        _Gateway.call_async = async_method
    return _Gateway()

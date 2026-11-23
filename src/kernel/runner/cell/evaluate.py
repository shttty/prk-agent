import asyncio
import inspect


async def _await_value(value):
    return await value if inspect.isawaitable(value) else value


async def evaluate_async_cell(ctx, body, tail):
    await _await_value(eval(body, ctx.namespace))
    if tail is not None:
        value = await _await_value(eval(tail, ctx.namespace))
        if value is not None:
            display_value(ctx, value)


async def _await_worker_value(ctx, cell, value):
    with own_private_task(ctx, cell):
        return await value


def evaluate_cell(ctx, cell, body, tail):
    """Run synchronous code outside a running loop, awaiting results as needed."""
    def evaluate(code):
        value = evaluate_worker_code(ctx, cell, code)
        if inspect.isawaitable(value):
            return asyncio.run(_await_worker_value(ctx, cell, value))
        return value

    evaluate(body)
    if tail is not None:
        value = evaluate(tail)
        if value is not None:
            display_value(ctx, value)

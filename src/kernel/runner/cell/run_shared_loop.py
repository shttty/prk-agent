import asyncio


async def _serve_shared_loop(ctx, ready):
    ctx.loop = asyncio.get_running_loop()
    ctx.loop_stop = asyncio.Event()
    ready.set()
    await ctx.loop_stop.wait()


def run_shared_loop(ctx, ready):
    # One run per generation: returning at EOF cancels live tasks and drains
    # async generators and the default executor before closing this loop.
    asyncio.run(_serve_shared_loop(ctx, ready))

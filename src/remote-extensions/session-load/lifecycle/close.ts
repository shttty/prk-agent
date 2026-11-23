import type { LoadContext } from "../load-types.ts";

export async function close(ctx: LoadContext): Promise<void> {
      const results = await Promise.allSettled(ctx.generations.map((generation) => generation.close()));
      ctx.input.onStatus?.([]);
      const errors = results.filter((result): result is PromiseRejectedResult => result.status === "rejected").map((result) => result.reason);
      if (errors.length) throw new AggregateError(errors, "Remote extension shutdown failed.");
}

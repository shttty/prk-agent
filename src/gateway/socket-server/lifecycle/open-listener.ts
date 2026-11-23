import type { ListenerContext } from "../listener-state.ts";

export function openListener(ctx: ListenerContext): Promise<void> {
  const { server, path } = ctx;
  return new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(path, () => { server.removeListener("error", reject); resolve(); });
  });
}

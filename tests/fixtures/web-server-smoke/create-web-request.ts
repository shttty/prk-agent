import { request as httpRequest } from "node:http";

export function createWebRequest(origin: string) {
return (
  path: string,
  options: { method?: string; headers?: Record<string, string>; body?: string; origin?: boolean } = {},
  base = origin,
): Promise<{ status: number; body: string }> => new Promise((resolve, reject) => {
  const outgoing = httpRequest(`${base}${path}`, {
    method: options.method ?? (options.body === undefined ? "GET" : "POST"),
    headers: {
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(options.origin === false ? {} : { Origin: base }),
      ...options.headers,
    },
    signal: AbortSignal.timeout(20_000),
  }, (incoming) => {
    let data = "";
    incoming.setEncoding("utf8");
    incoming.on("data", (chunk) => { data += chunk; });
    incoming.once("error", reject);
    incoming.once("end", () => {
      resolve({ status: incoming.statusCode ?? 0, body: data });
    });
  });
  outgoing.once("error", reject);
  outgoing.end(options.body);
});
}

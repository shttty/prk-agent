

export async function browserJson(ctx, page, path) {
  return page.evaluate(async (requestPath) => {
    const response = await fetch(requestPath, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
    const body = await response.text();
    let parsed;
    try { parsed = body ? JSON.parse(body) : null; } catch { parsed = { error: `Invalid JSON response (HTTP ${response.status})` }; }
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${typeof parsed?.error === "string" ? parsed.error : "request failed"}`);
    return parsed;
  }, path);
}

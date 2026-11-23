
export function namespaceFor(apiRoot) {
  try {
    const gateway = new URL(apiRoot, globalThis.location?.href || "http://localhost/");
    return `${globalThis.location?.origin || gateway.origin}${gateway.pathname}:sessions-v1`;
  } catch {
    return `${apiRoot}:sessions-v1`;
  }
}


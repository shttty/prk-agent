/** A JSON.stringify replacer: providers mark the last message with `cache_control` and move the mark on the next request, which is not a change of the message. */
export function withoutCacheMarker(key: string, value: unknown): unknown { return key === "cache_control" ? undefined : value; }

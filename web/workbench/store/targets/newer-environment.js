// The whole terminal snapshot (bytes, percent, error): the page shows it while the stream sits idle after the task.
const terminal = (environment) => {
  if (!["ready", "failed"].includes(environment.status)) return undefined;
  const { settled: _settled, ...snapshot } = environment;
  return snapshot;
};

/** Which of two environment snapshots of one instance the page keeps: within one Gateway stream only a higher revision
 * replaces (an older HTTP answer never overwrites a newer event); a different stream replaces outright (the Gateway's
 * environment state started over, old progress is dropped). The kept snapshot also carries `settled`, the stream's last
 * ready/failed snapshot seen: a terminal state can be followed within milliseconds by idle, and a page that renders
 * less often than events arrive must still learn how the task it waited on ended. */
export function newerEnvironment(current, incoming) {
  if (!incoming) return current ?? null;
  if (!current || current.streamId !== incoming.streamId) return { ...incoming, settled: terminal(incoming) };
  if (incoming.revision < current.revision) return current;
  return { ...incoming, settled: terminal(incoming) ?? current.settled };
}

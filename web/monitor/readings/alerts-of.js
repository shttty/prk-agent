
export function alertsOf(sessionRow) {
  const alerts = sessionRow?.monitor?.alerts;
  const kernel = alerts?.kernel === true;
  const oom = alerts?.oom === true;
  const memory = alerts?.memory === true;
  return { kernel, oom, memory, any: kernel || oom || memory };
}

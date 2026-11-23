// Posts a session native action from the page (same origin and HTTP route as the UI's own controls).
export function nativeAction(page, name) {
  return (action, args) => page.evaluate(async ({ name, action, args }) => {
    const response = await fetch(`/api/sessions/${name}/native`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: crypto.randomUUID(), action, args }),
    });
    return { httpStatus: response.status, body: await response.json() };
  }, { name, action, args });
}

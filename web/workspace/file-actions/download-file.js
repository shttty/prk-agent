export function downloadFile(action, target, path) {
  const form = document.createElement("form");
  form.method = "post";
  form.action = action;
  form.target = "_blank";
  form.rel = "noopener";
  form.hidden = true;
  for (const [name, value] of Object.entries({ target, path })) {
    const field = document.createElement("input");
    field.type = "hidden";
    field.name = name;
    field.value = value;
    form.append(field);
  }
  document.body.append(form);
  form.submit();
  form.remove();
}

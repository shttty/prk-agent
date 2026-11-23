import { Textarea } from "@mantine/core";
/** The free text of the "other" answer or a note. `update` takes a function of the current field. */
export function TextField({ kind, value, update, placeholder }) {
  return <div className="pi-ask-field" data-ask-field={kind}>
    <Textarea
      autosize
      minRows={2}
      maxRows={6}
      autoFocus
      value={value.text}
      placeholder={placeholder}
      aria-label={placeholder}
      onChange={(event) => { const text = event.currentTarget.value; update((field) => ({ ...field, text })); }}
    />
  </div>;
}

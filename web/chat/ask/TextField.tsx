import { Stack, Textarea } from "@mantine/core";

type TextFieldProps = { kind: "custom" | "note"; value: { text: string }; update: (text: string) => void; placeholder: string };

/** The free text of the "other" answer or a note. */
export function TextField({ kind, value, update, placeholder }: TextFieldProps) {
  return <Stack gap={6} miw={0} data-ask-field={kind}>
    <Textarea
      autosize
      minRows={2}
      maxRows={6}
      autoFocus
      value={value.text}
      placeholder={placeholder}
      aria-label={placeholder}
      onChange={(event) => update(event.currentTarget.value)}
    />
  </Stack>;
}

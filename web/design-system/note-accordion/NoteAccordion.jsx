import { Accordion } from "@mantine/core";
export const STYLES = { control: { padding: "2px 0" }, label: { padding: "2px 0", fontSize: "var(--mantine-font-size-xs)", color: "var(--mantine-color-dimmed)" }, content: { padding: "4px 0 0" } };

export default function NoteAccordion({ title, children, ...props }) {
  return <Accordion variant="default" chevronPosition="left" styles={STYLES} {...props}>
    <Accordion.Item value="note">
      <Accordion.Control data-action="toggle-note">{title}</Accordion.Control>
      <Accordion.Panel>{children}</Accordion.Panel>
    </Accordion.Item>
  </Accordion>;
}


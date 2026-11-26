import { Accordion, type AccordionProps } from "@mantine/core";
import type { ReactNode } from "react";

type NoteAccordionProps = Omit<AccordionProps, "children" | "title"> & { title: ReactNode; children?: ReactNode };

const NOTE_STYLES: AccordionProps["styles"] = { control: { padding: "2px 0" }, label: { padding: "2px 0", fontSize: "var(--mantine-font-size-xs)", color: "var(--mantine-color-dimmed)" }, content: { padding: "4px 0 0" } };

export default function NoteAccordion({ title, children, ...props }: NoteAccordionProps) {
  return <Accordion variant="default" chevronPosition="left" styles={NOTE_STYLES} {...props}>
    <Accordion.Item value="note">
      <Accordion.Control data-action="toggle-note">{title}</Accordion.Control>
      <Accordion.Panel>{children}</Accordion.Panel>
    </Accordion.Item>
  </Accordion>;
}

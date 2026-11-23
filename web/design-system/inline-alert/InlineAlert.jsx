import { Alert } from "@mantine/core";
export default function InlineAlert({ color = "red", size = "xs", children, ...props }) {
  return <Alert color={color} p="xs" styles={{ message: { fontSize: `var(--mantine-font-size-${size})` } }} {...props}>{children}</Alert>;
}


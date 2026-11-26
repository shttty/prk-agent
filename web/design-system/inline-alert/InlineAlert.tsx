import { Alert, type AlertProps, type MantineSize } from "@mantine/core";

type InlineAlertProps = AlertProps & { size?: MantineSize };

export default function InlineAlert({ color = "red", size = "xs", children, ...props }: InlineAlertProps) {
  return <Alert color={color} p="xs" styles={{ message: { fontSize: `var(--mantine-font-size-${size})` } }} {...props}>{children}</Alert>;
}

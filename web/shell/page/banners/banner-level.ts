import type { ReactElement } from "react";
import type { AlertProps } from "@mantine/core";

export const levelOf = (items: readonly ReactElement<AlertProps>[]) => (items.some((item) => item.props.color === "red") ? "error" : items.some((item) => item.props.color === "yellow") ? "warn" : "info");

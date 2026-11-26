import type { ReactNode } from "react";
import InlineAlert from "../inline-alert/InlineAlert.tsx";

type FormErrorProps = { children?: ReactNode; id?: string };

export function FormError({ children, id }: FormErrorProps) {
  return children ? <InlineAlert id={id} size="sm">{children}</InlineAlert> : null;
}

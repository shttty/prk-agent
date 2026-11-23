import InlineAlert from "../inline-alert/InlineAlert.jsx";
export function FormError({ children, id }) {
  return children ? <InlineAlert id={id} size="sm">{children}</InlineAlert> : null;
}

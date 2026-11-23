import InlineAlert from "../../design-system/inline-alert/InlineAlert.jsx";
/** One structured provider ownership diagnostic (`ProviderPolicyError`, docs/wire/native.md). */
export function ProviderPolicyAlert({ item }) {
  return <InlineAlert data-field="provider-error" data-code={item.code} data-provider-id={item.providerId} data-operation={item.operation} data-path={item.path} data-source={item.source}>provider：{item.providerId} · {item.operation} · {item.error}{item.path ? ` · ${item.path}` : ""}</InlineAlert>;
}

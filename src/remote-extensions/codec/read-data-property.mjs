export function dataProperty(object, key) {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (!descriptor || !("value" in descriptor)) throw new TypeError("Remote extension codec rejects accessor properties");
  return descriptor.value;
}

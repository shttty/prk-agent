
export const getPath = (object, key) => key.split(".").reduce((value, part) => (value == null ? undefined : value[part]), object);

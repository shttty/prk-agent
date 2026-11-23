export type EncodedValue =
  | ["undefined"]
  | ["null"]
  | ["string", string]
  | ["boolean", boolean]
  | ["number", number | "-0"]
  | ["array", EncodedValue[]]
  | ["object", [string, EncodedValue][]]
  | ["error", EncodedValue];

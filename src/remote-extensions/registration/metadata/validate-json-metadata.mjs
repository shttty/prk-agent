import { encode } from "../../codec/encode.mjs";
import { decode } from "../../codec/decode.mjs";
import { visit } from "./visit-json-metadata.mjs";

export function jsonMetadata(value, label) {
  const encoded = encode(value);
  visit(encoded, label);
  return decode(encoded);
}

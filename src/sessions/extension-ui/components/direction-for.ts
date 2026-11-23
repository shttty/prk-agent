export function directionFor(name: string): "row" | "column" {
  return name === "HStack" ? "row" : "column";
}

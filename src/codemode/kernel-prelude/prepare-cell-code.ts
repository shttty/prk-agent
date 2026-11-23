export function prepareKernelCode(code: string, title = "Python cell"): string {
  return `_prk.begin_cell(${JSON.stringify(title)})\n${code}`;
}

// Engine-specific value flags follow rtk's search argument extraction. Unknown flags
// deliberately disable hit windows instead of treating an option value as the pattern.
export const GREP_VALUES: Record<string, true> = {
  "after-context": true, "before-context": true, "binary-files": true, context: true,
  devices: true, directories: true, exclude: true, "exclude-dir": true, "exclude-from": true,
  file: true, "group-separator": true, include: true, label: true, "max-count": true, regexp: true,
};
export const RG_VALUES: Record<string, true> = {
  "after-context": true, "before-context": true, color: true, colors: true, context: true,
  "context-separator": true, "dfa-size-limit": true, encoding: true, engine: true,
  "field-context-separator": true, "field-match-separator": true, file: true, generate: true,
  glob: true, "hostname-bin": true, "hyperlink-format": true, iglob: true, "ignore-file": true,
  "max-columns": true, "max-count": true, "max-depth": true, "max-filesize": true,
  "path-separator": true, pre: true, "pre-glob": true, "regex-size-limit": true,
  regexp: true, replace: true, sort: true, sortr: true, threads: true,
  type: true, "type-add": true, "type-clear": true, "type-not": true,
};
export const COMMON_FLAGS: Record<string, true> = {
  text: true, count: true, "fixed-strings": true, "ignore-case": true, "no-ignore-case": true,
  "line-number": true, "no-line-number": true, "with-filename": true, "no-filename": true,
  "files-with-matches": true, "files-without-match": true, "only-matching": true,
  quiet: true, silent: true, recursive: true, "line-regexp": true, "word-regexp": true,
  null: true, "null-data": true, binary: true, "extended-regexp": true, "basic-regexp": true, "perl-regexp": true,
};
export const RG_FLAGS: Record<string, true> = {
  hidden: true, "no-ignore": true, "no-ignore-vcs": true, "no-heading": true, heading: true,
  follow: true, multiline: true, "multiline-dotall": true, pcre2: true, crlf: true,
  "no-unicode": true, unicode: true, stats: true, trim: true, passthru: true,
  "search-zip": true, "line-buffered": true, "no-messages": true,
};

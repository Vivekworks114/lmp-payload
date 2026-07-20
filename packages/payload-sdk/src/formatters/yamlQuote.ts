/**
 * Quote YAML scalars that would otherwise be parsed as non-strings.
 * Critical for `slug`: Astro content-layer does `id.endsWith(".svg")` where
 * `id` comes from `data.slug` — a numeric slug like `123` must stay a string.
 */
export function quoteYamlScalar(s: string): string {
  const needsQuotes =
    s === '' ||
    /^(true|false|null|~|yes|no|on|off)$/i.test(s) ||
    /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(s) ||
    /^\d{4}-\d{2}-\d{2}/.test(s) ||
    !/^[\w\d:./@-]+$/.test(s)

  if (!needsQuotes) return s
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

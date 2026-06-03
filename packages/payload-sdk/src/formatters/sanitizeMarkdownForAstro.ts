/**
 * Fix WordPress / Turndown markdown that breaks Astro builds.
 *
 * Astro resolves `![alt](dest)` image destinations as Vite imports when `dest`
 * is not a remote URL. A nested link like `![alt]([https://…](https://…))`
 * is treated as a relative path and fails with "Rollup failed to resolve import".
 */
export function sanitizeMarkdownForAstro(md: string): string {
  let out = md

  // ![alt]([label](url)) → ![alt](url)
  out = out.replace(
    /!\[([^\]]*)\]\(\[([^\]]+)\]\(([^)]+)\)\)/g,
    (_match, alt: string, _label: string, url: string) => `![${alt}](${url})`,
  )

  // [![alt](url)](url) → ![alt](url) when href and src are the same remote URL
  out = out.replace(
    /\[!\[([^\]]*)\]\((https?:\/\/[^)]+)\)\]\((https?:\/\/[^)]+)\)/gi,
    (_match, alt: string, imgUrl: string, linkUrl: string) =>
      imgUrl === linkUrl ? `![${alt}](${imgUrl})` : _match,
  )

  return out
}

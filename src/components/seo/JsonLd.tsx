/**
 * Renders a JSON-LD `<script>` block.
 *
 * `JSON.stringify` escapes `"` but NOT `<`, so any user-supplied string that
 * contains `</script>` would close the tag and let the rest execute as HTML.
 * Escaping `<` as `<` keeps the payload valid JSON while making tag
 * breakout impossible. Every JSON-LD block on the site must go through here.
 */
function serialize(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serialize(data) }}
    />
  )
}

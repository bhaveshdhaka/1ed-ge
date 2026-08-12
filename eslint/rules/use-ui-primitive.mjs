/**
 * use-ui-primitive — design-system governance gate.
 *
 * Flags raw, hand-inlined class clusters that the design system says should be
 * owned by a src/components/ui/* primitive.  When a page hand-writes `.panel`,
 * `.card-hd`, `.btn`, `.well`, or `.badge`-style markup instead of using the
 * <Card>/<Button>/<Well>/<Badge> component, this rule reports it.
 *
 * The astro parser exposes class attribute values as string `Literal` nodes
 * (same representation the no-arbitrary-tailwind rule relies on).  We match
 * the well-known primitive class tokens inside those literals.  The tokens
 * are distinctive enough that they don't appear in ordinary text or other
 * string props.
 *
 * This rule is advisory during migration — it reports, it does not auto-fix.
 */

// class-token → the primitive that should own it
const PRIMITIVES = {
  panel: 'Card',
  'panel-hero': 'Card',
  'panel-static': 'Card',
  'panel-flat': 'Card',
  'card-hd': 'Card',
  'card-ico': 'Card',
  'card-lbl': 'Card',
  'card-sub': 'Card',
  well: 'Well',
  'btn-primary': 'Button',
  'btn-danger': 'Button',
  badge: 'Badge',
}

// Match a bare class token inside a class attribute value (space/boundary delimited).
const TOKEN_RE = /(^|[\s"'])(panel[\w-]*|card-hd|card-ico|card-lbl|card-sub|well|btn-primary|btn-danger|badge)(?=[\s"'`]|$)/

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Flag raw inline markup where a src/components/ui primitive should be used',
      recommended: false,
    },
    schema: [],
    messages: {
      usePrimitive:
        'Raw "{{ token }}" class — use the <{{ primitive }}> primitive instead of hand-inlining this markup.',
    },
  },
  create(context) {
    return {
      Literal(node) {
        if (typeof node.value !== 'string') return
        const re = new RegExp(TOKEN_RE.source, 'g')
        let m
        while ((m = re.exec(node.value))) {
          const token = m[2]
          const primitive = PRIMITIVES[token]
          if (primitive) {
            context.report({
              node,
              messageId: 'usePrimitive',
              data: { token, primitive },
            })
          }
        }
      },
    }
  },
}
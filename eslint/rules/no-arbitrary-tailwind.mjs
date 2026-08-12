/**
 * no-arbitrary-tailwind — design-system gate.
 * Flags arbitrary Tailwind values (text-[..px], bg-[#hex], border-[..]) in
 * string literals inside .astro / .tsx / .ts. Replaces the grep-based
 * scripts/design-lint.sh with a proper lint rule so CI can fail the build.
 *
 * Pattern matches the original scanner: /(?:text|bg|border)-\[[^\]]+\]/
 */
const ARBITRARY_RE = /(?:text|bg|border)-\[[^\]]+\]/

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow arbitrary Tailwind values (text-[..], bg-[..], border-[..]) — use design tokens',
      recommended: true,
    },
    schema: [],
    messages: {
      arbitraryTailwind: 'Arbitrary Tailwind value "{{ value }}" — use a design token instead (see /build palette/type scale).',
    },
  },
  create(context) {
    return {
      Literal(node) {
        if (typeof node.value !== 'string') return
        const m = node.value.match(ARBITRARY_RE)
        if (m) {
          context.report({
            node,
            messageId: 'arbitraryTailwind',
            data: { value: m[0] },
          })
        }
      },
    }
  },
}

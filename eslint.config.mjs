import astro from 'eslint-plugin-astro'
import { parseForESLint, meta as astroParserMeta } from 'astro-eslint-parser'
import tsParser from '@typescript-eslint/parser'
import noArbitraryTailwind from './eslint/rules/no-arbitrary-tailwind.mjs'

// astro-eslint-parser exposes named exports (parseForESLint + meta), no default.
// Build a parser object ESLint accepts via languageOptions.parser.
const astroParser = {
  meta: astroParserMeta,
  parseForESLint,
}

export default [
  {
    // Only .astro files are linted — TS/TSX are covered by `astro check` (typecheck),
    // and the original design-lint.sh scanned .astro only. JS/scripts stay out of scope.
    ignores: [
      'dist/**',
      'node_modules/**',
      '.astro/**',
      'playwright-report/**',
      'test-results/**',
      '.lighthouseci/**',
      '**/*.ts',
      '**/*.tsx',
      '**/*.js',
      '**/*.mjs',
      '**/*.jsx',
    ],
  },
  // astro base: sets the astro plugin + the .astro template processor (parses
  // frontmatter as TS, template expressions as JS). No prettier/jsx-a11y — those
  // peers conflict with ESLint 10, so we skip the recommended preset on purpose.
  ...astro.configs.base,
  {
    files: ['**/*.astro'],
    languageOptions: {
      parser: astroParser,
      parserOptions: {
        parser: tsParser,
        extraFileExtensions: ['.astro'],
      },
    },
    plugins: {
      custom: {
        rules: {
          'no-arbitrary-tailwind': noArbitraryTailwind,
        },
      },
    },
    rules: {
      // our design-system gate: flag arbitrary tailwind values (text-[, bg-[, border-[)
      'custom/no-arbitrary-tailwind': 'error',
    },
  },
]

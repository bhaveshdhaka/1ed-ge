const fs = require('fs')
const PORT = process.env.TEST_PORT ?? 4323
const SECRET = (fs.readFileSync('.env', 'utf8').match(/^ADMIN_SECRET=(.*)$/m) ?? [])[1]?.trim()

const PUBLIC_URLS = [
  `http://127.0.0.1:${PORT}/`,
  `http://127.0.0.1:${PORT}/journal`,
  `http://127.0.0.1:${PORT}/performance`,
  `http://127.0.0.1:${PORT}/tracker`,
  `http://127.0.0.1:${PORT}/trends`,
  `http://127.0.0.1:${PORT}/accounts`,
  `http://127.0.0.1:${PORT}/coach`,
  `http://127.0.0.1:${PORT}/about`,
]

module.exports = {
  ci: {
    collect: {
      startServerCommand: `PORT=${PORT} node dist/server/entry.mjs`,
      startServerReadyPattern: 'Server listening',
      url: PUBLIC_URLS,
      numberOfRuns: 2,
      settings: {
        chromeFlags: '--no-sandbox --disable-gpu --disable-dev-shm-usage',
        throttlingMethod: 'simulate',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.95 }],
        'categories:seo': ['error', { minScore: 0.95 }],
        'resource-summary:script:count': ['error', { maxNumericValue: 0 }],
        'resource-summary:script:transferSize': ['error', { maxNumericValue: 0 }],
        'unused-javascript': ['warn', { maxLength: 0 }],
      },
    },
    upload: { target: 'filesystem', outputDir: '.lhci' },
  },
}

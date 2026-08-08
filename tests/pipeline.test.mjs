import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const run = (cmd, args = [], env = {}) => {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    timeout: 15_000,
  })
  return { stdout: r.stdout ?? '', stderr: r.stderr ?? '', code: r.status ?? -1 }
}

let pass = 0
let fail = 0
const ok = (cond, label) => {
  if (cond) {
    console.log(`  ✓ ${label}`)
    pass++
    return true
  }
  console.log(`  ✗ ${label}`)
  fail++
  return false
}

const test = (label, fn) => {
  console.log(`\n${label}`)
  try {
    fn()
  } catch (e) {
    console.log(`  ✗ threw: ${e.message}`)
    fail++
  }
}

test('env.sh require_env refuses wrong env', () => {
  // simulate a prod worktree but ask for test
  const r = run('bash', ['-c', 'source scripts/lib/env.sh; require_env test'], { SITE_ENV: 'prod' })
  ok(r.code === 1, 'exit code 1 when expected=test actual=prod')
  ok(/refusing: this script requires SITE_ENV=test/.test(r.stderr), 'stderr names the expected env')
  ok(/SITE_ENV=prod/.test(r.stderr), 'stderr names the actual env')
})

test('env.sh require_env passes right env', () => {
  const r = run('bash', ['-c', 'source scripts/lib/env.sh; require_env prod; echo OK'], { SITE_ENV: 'prod' })
  ok(r.code === 0, 'exit 0 when expected=prod actual=prod')
  ok(/OK/.test(r.stdout), 'stdout contains OK')
})

test('env.sh derives SITE_NOINDEX from SITE_ENV', () => {
  const testEnv = run('bash', ['-c', 'source scripts/lib/env.sh; load_env; echo $SITE_NOINDEX'], { SITE_ENV: 'test' })
  ok(testEnv.stdout.trim() === '1', 'test env → SITE_NOINDEX=1')
  const prodEnv = run('bash', ['-c', 'source scripts/lib/env.sh; load_env; echo $SITE_NOINDEX'], { SITE_ENV: 'prod' })
  ok(prodEnv.stdout.trim() === '0', 'prod env → SITE_NOINDEX=0')
})

test('where-am-i.sh prints env snapshot', () => {
  const r = run('bash', ['scripts/where-am-i.sh'], { SITE_ENV: 'test', SITE_URL: 'https://test.1ed.ge', SITE_PORT: '4323' })
  ok(r.code === 0, 'exit 0')
  ok(/env:\s+test/.test(r.stdout), 'prints env: test')
  ok(/url:\s+https:\/\/test\.1ed\.ge/.test(r.stdout), 'prints url')
  ok(/port:\s+4323/.test(r.stdout), 'prints port')
  ok(/noindex:\s+1/.test(r.stdout), 'prints noindex: 1')
})

test('seed.mjs refuses when SITE_ENV is not test', () => {
  const r = run('node', ['scripts/seed.mjs'], { SITE_ENV: 'prod' })
  ok(r.code === 1, 'exit 1 in prod')
  ok(/refusing/.test(r.stderr), 'stderr says refusing')
  ok(/SITE_ENV is "prod"/.test(r.stderr), 'stderr names the env')
})

test('seed.mjs refuses when SITE_ENV is unset', () => {
  const r = run('node', ['scripts/seed.mjs'], { SITE_ENV: '' })
  ok(r.code === 1, 'exit 1 when SITE_ENV is empty')
  ok(/refusing/.test(r.stderr), 'stderr says refusing')
})

test('seed-review.mjs refuses when SITE_ENV is not test', () => {
  const r = run('node', ['scripts/seed-review.mjs', '--days=1'], { SITE_ENV: 'prod' })
  ok(r.code === 1, 'exit 1 in prod')
  ok(/CLEAR|clears|destroys/i.test(r.stderr), 'stderr warns about destruction')
})

test('seed-prod.sh always refuses with instructions', () => {
  const r = run('bash', ['scripts/seed-prod.sh'], { SITE_ENV: 'prod' })
  ok(r.code === 1, 'exit 1')
  ok(/seed-prod is not a thing/.test(r.stdout), 'stdout explains')
  ok(/SITE_ENV=test node/.test(r.stdout), 'stdout shows the override')
})

console.log(`\n${pass} pass · ${fail} fail`)
process.exit(fail === 0 ? 0 : 1)

import { test } from 'node:test'
import assert from 'node:assert/strict'

const { GET } = await import('../src/pages/health')

test('/health answers ok with no data and no auth', async () => {
  const res = await GET({} as never)
  assert.equal(res.status, 200)
  assert.equal(await res.text(), 'ok')
})

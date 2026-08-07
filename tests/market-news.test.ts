import { test } from 'node:test'
import assert from 'node:assert/strict'
import { groupNewsHeadlines, newsEmoji, groupNewsByTime, newsHeadline } from '../src/lib/market-news'

test('groupNewsHeadlines: same-time red + orange collapse into one group, rep = first red', () => {
  const red = [
    { time: '20:30', currency: 'USD', title: 'CPI y/y', source: 'TV' as const, verified: true },
  ]
  const orange = [
    { time: '20:30', currency: 'USD', title: 'Core CPI m/m', source: 'FF' as const },
    { time: '20:30', currency: 'USD', title: 'Retail Sales m/m', source: 'TV' as const },
    { time: '21:00', currency: 'USD', title: 'ISM Manufacturing PMI', source: 'TV' as const },
  ]
  const groups = groupNewsHeadlines(red, orange)

  assert.equal(groups.length, 2)
  assert.equal(groups[0].time, '20:30')
  assert.equal(groups[0].kind, 'red')
  assert.equal(groups[0].title, 'CPI y/y') // rep = first red
  assert.equal(groups[0].rest.length, 2) // both oranges stay in rest
  assert.equal(groups[0].rest[0].kind, 'orange')
  assert.equal(groups[1].time, '21:00')
  assert.equal(groups[1].kind, 'orange')
  assert.equal(groups[1].rest.length, 0)
})

test('groupNewsHeadlines: groups sort by time', () => {
  const groups = groupNewsHeadlines(
    [{ time: '22:00', currency: 'USD', title: 'Late' }],
    [{ time: '08:30', currency: 'USD', title: 'Early' }],
  )
  assert.deepEqual(groups.map((g) => g.time), ['08:30', '22:00'])
})

test('groupNewsHeadlines: empty input -> empty output', () => {
  assert.deepEqual(groupNewsHeadlines([], []), [])
})

test('newsEmoji: known titles get their icon, unknown gets the fallback', () => {
  assert.equal(newsEmoji('CPI inflation report y/y'), '🛒')
  assert.equal(newsEmoji('Crude Oil Inventories'), '🛢️')
  assert.equal(newsEmoji('Nonfarm Payrolls'), '💼')
  assert.equal(newsEmoji('Fed Chair Powell speaks'), '🗣️')
  assert.equal(newsEmoji('something completely unrelated'), '📰')
})

test('newsEmoji: never returns an empty string', () => {
  const titles = ['', 'Zzz', 'a', 'no match here at all', '1234', '␀']
  for (const t of titles) {
    assert.notEqual(newsEmoji(t), '')
  }
})

test('groupNewsByTime: consecutive same-time items collapse into one group', () => {
  const groups = groupNewsByTime([
    { time: '20:30', currency: 'USD', title: 'CPI' },
    { time: '20:30', currency: 'USD', title: 'Core CPI' },
    { time: '21:00', currency: 'USD', title: 'ISM' },
  ])
  assert.equal(groups.length, 2)
  assert.deepEqual(groups[0], { time: '20:30', titles: ['CPI', 'Core CPI'] })
  assert.deepEqual(groups[1], { time: '21:00', titles: ['ISM'] })
})

test('newsHeadline: first red else first orange else null', () => {
  const red = newsHeadline([{ time: '20:30', currency: 'USD', title: 'CPI' }], [])
  assert.equal(red?.kind, 'red')
  const h = newsHeadline([], [{ time: '21:00', currency: 'USD', title: 'ISM' }])
  assert.equal(h?.kind, 'orange')
  assert.equal(h?.title, 'ISM')
  assert.equal(newsHeadline([], []), null)
})

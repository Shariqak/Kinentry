import { describe, it, expect } from 'vitest'
import { formatAge, isAtRisk } from './intakeQueueHelpers'

const hoursAgo = (h) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString()

describe('formatAge', () => {
  it('shows "just now" for under an hour', () => {
    expect(formatAge(hoursAgo(0.5))).toBe('just now')
  })
  it('shows hours for under a day', () => {
    expect(formatAge(hoursAgo(5))).toBe('5h')
  })
  it('shows days and hours beyond a day', () => {
    expect(formatAge(hoursAgo(30))).toBe('1d 6h')
    expect(formatAge(hoursAgo(100))).toBe('4d 4h')
  })
})

describe('isAtRisk', () => {
  it('is false for an unresolved case under the threshold', () => {
    expect(isAtRisk({ status: 'pending', created_at: hoursAgo(48) })).toBe(false)
  })
  it('is true for an unresolved case past the threshold', () => {
    expect(isAtRisk({ status: 'pending', created_at: hoursAgo(96) })).toBe(true)
  })
  it('is false for a resolved case, no matter how old', () => {
    expect(isAtRisk({ status: 'verified', created_at: hoursAgo(240) })).toBe(false)
    expect(isAtRisk({ status: 'ineligible', created_at: hoursAgo(240) })).toBe(false)
  })
  it('respects a custom threshold', () => {
    expect(isAtRisk({ status: 'under_review', created_at: hoursAgo(30) }, 1)).toBe(true)
    expect(isAtRisk({ status: 'under_review', created_at: hoursAgo(30) }, 2)).toBe(false)
  })
})

import { describe, it, expect } from 'vitest'
import { parseInsuranceCardText, parseDriverLicenseText } from './ocr'

describe('parseInsuranceCardText', () => {
  it('extracts all fields from clean, labeled card text', () => {
    const text = `
BLUE CROSS BLUE SHIELD
Member Name: JOHN A SMITH
Member ID: XJB123456789
Group Number: 55221
Plan Type: PPO
`
    const result = parseInsuranceCardText(text)
    expect(result).toEqual({
      insurance_provider: 'BLUE CROSS BLUE SHIELD',
      member_id: 'XJB123456789',
      group_number: '55221',
      plan_type: 'PPO',
      policy_holder: 'JOHN A SMITH',
    })
  })

  it('handles single-word insurers and leaves unknown fields null rather than guessing', () => {
    const text = `AETNA\nID: W998877665\n`
    const result = parseInsuranceCardText(text)
    expect(result.insurance_provider).toBe('AETNA')
    expect(result.member_id).toBe('W998877665')
    expect(result.group_number).toBeNull()
    expect(result.plan_type).toBeNull()
  })
})

describe('parseDriverLicenseText', () => {
  it('extracts all fields from clean license text', () => {
    const text = `
TEXAS
DRIVER LICENSE
JOHN A SMITH
DOB 01/15/1990
DL 12345678
EXP 03/22/2029
`
    const result = parseDriverLicenseText(text)
    expect(result.full_name).toBe('JOHN A SMITH')
    expect(result.date_of_birth).toBe('1990-01-15')
    expect(result.license_number).toBe('12345678')
    expect(result.license_state).toBe('TX')
    expect(result.expiration_date).toBe('2029-03-22')
  })

  it('does not mistake the word "LICENSE" for a license-number label match', () => {
    const text = `CA DRIVER LICENSE\nDOB 07/04/1985\n`
    const result = parseDriverLicenseText(text)
    expect(result.license_number).toBeNull()
    expect(result.license_state).toBe('CA')
    expect(result.date_of_birth).toBe('1985-07-04')
  })

  it('does not let a single ambiguous date fill both DOB and expiration', () => {
    const text = `CA DRIVER LICENSE\nDOB 07/04/1985\n`
    const result = parseDriverLicenseText(text)
    expect(result.expiration_date).toBeNull()
  })
})

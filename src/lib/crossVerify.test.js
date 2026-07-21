import { describe, it, expect } from 'vitest'
import { crossVerifyIdentity } from './crossVerify'

describe('crossVerifyIdentity', () => {
  it('verifies when name and DOB match (allowing minor formatting differences)', () => {
    const result = crossVerifyIdentity({
      idData: { full_name: 'John A Smith', date_of_birth: '1990-01-01' },
      patientRecord: { full_name: 'John A. Smith', date_of_birth: '1990-01-01' },
    })
    expect(result.status).toBe('verified')
  })

  it('flags a partial match when only DOB differs', () => {
    const result = crossVerifyIdentity({
      idData: { full_name: 'John Smith', date_of_birth: '1990-01-01' },
      patientRecord: { full_name: 'John Smith', date_of_birth: '1985-05-12' },
    })
    expect(result.status).toBe('partial_match')
  })

  it('flags a mismatch when neither name nor DOB match', () => {
    const result = crossVerifyIdentity({
      idData: { full_name: 'Jane Doe', date_of_birth: '1990-01-01' },
      patientRecord: { full_name: 'John Smith', date_of_birth: '1985-05-12' },
    })
    expect(result.status).toBe('mismatch')
  })

  it('does not penalize a dependent whose insurance policy holder is a parent', () => {
    const result = crossVerifyIdentity({
      idData: { full_name: 'Little Kid', date_of_birth: '2015-06-01' },
      patientRecord: { full_name: 'Little Kid', date_of_birth: '2015-06-01' },
      insuranceRecord: { policy_holder: 'Parent Guardian' },
    })
    expect(result.status).toBe('verified')
    const policyCheck = result.checks.find((c) => c.field === 'insurance_policy_holder')
    expect(policyCheck.informational).toBe(true)
  })
})

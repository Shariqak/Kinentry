# Path to Production: What's Still Needed

This is an honest checklist of what stands between the current codebase and safely handling **real** patient data. None of these are code changes — they are legal, contractual, and organizational steps that a codebase cannot substitute for, no matter how well-tested.

**Do not put real PHI into this system until the items in "Before any real patient data" are done.**

## Before any real patient data

- [ ] **Signed Business Associate Agreement (BAA) with Supabase** — required under HIPAA before any real PHI can be stored in their infrastructure
- [ ] **Signed BAA with Vercel** — same requirement, for hosting
- [ ] **Formal HIPAA risk assessment** — typically done with a compliance consultant or lawyer; identifies gaps this technical document can't see
- [ ] **Written security policies** — access control policy, incident response plan, breach notification procedure (HIPAA requires these to exist in writing, not just be implemented in practice)
- [ ] **Staff training program** — anyone with `staff`/`admin` access needs documented HIPAA training, not just a role in the database
- [ ] **Data retention & disposal policy** — how long is data kept, how is it destroyed when no longer needed

## Before EU/UK patients specifically (GDPR)

- [ ] **Lawful basis for processing health data** — GDPR treats health data as a "special category" requiring explicit justification
- [ ] **Data Processing Agreement (DPA) with Supabase/Vercel** — GDPR's equivalent of a BAA
- [ ] **Privacy policy covering GDPR-specific rights** — right to erasure (the `deletion_requests` flow already built here is a good technical start, but needs a policy wrapping it)

## Before scaling beyond a single pilot clinic

- [ ] **Separate staging environment** — currently developing directly against production Supabase, acceptable only because no real patient data exists yet
- [ ] **Formal incident response runbook** — who does what if there's a suspected breach
- [ ] **Penetration test / third-party security review** — an outside review of exactly what's described in `SECURITY.md`, since self-review has blind spots by definition

## Technical items still open (tracked separately, not blockers for this list)

- Real payer eligibility API (currently simulated) — needs a vendor relationship (Availity/Waystar), not just code
- Real EHR integration — needs a formal vendor partnership/certification process, likely 6-12+ months, should not be built speculatively before a clinic requires it
- Email delivery (Resend) — parked, not blocking
- `npm audit` currently informational only in CI — revisit tightening this once dependency noise settles

---
*Last updated alongside the 2026-07-26 security audit. Update this file as items are completed — it should always reflect current reality, not be treated as a one-time checklist.*

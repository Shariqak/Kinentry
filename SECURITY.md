# Security Architecture

This document describes Identra's actual, tested security posture — not aspirational goals. Every claim below has been directly verified, either through automated tests (`supabase/tests/rls_test.sql`, run in CI on every push) or manual testing documented in project history.

## Access control model

Every table uses Postgres Row-Level Security (RLS), enforced at the database layer — not just in application code. This means even a bug in the frontend cannot leak another patient's data; the database itself refuses the query.

**Roles:** `patient`, `staff`, `admin` (stored on each user's own row, checked via a `SECURITY DEFINER` helper function to avoid RLS self-reference recursion).

**Pattern:** patients can read/write their own records; staff/admin can read broadly and write specific fields; nothing is ever open by default. On 2026-07-26, a full audit of every table's policies found and fixed two real gaps (staff couldn't read other patients' records; staff's enrollment status updates were silently failing). Both are now covered by permanent regression tests — see below.

## Automated RLS regression testing

`supabase/tests/rls_test.sql` runs against a real, disposable Postgres instance in CI on every push (`rls-security-tests` job in `.github/workflows/ci.yml`). It directly reproduces both bugs found in the 2026-07-26 audit and asserts they cannot recur, plus verifies every other table's access boundaries (patient isolation, staff visibility, tamper-proof audit logs, appointment self-service limits).

This is a real safety net: if a future migration reintroduces either bug, or opens a new gap in a table this suite covers, CI fails with a clear error message before the change reaches production.

## Audit trail

`audit_logs` is structurally append-only — no `UPDATE` or `DELETE` policy exists for any role, including admin. Under Postgres RLS, no policy means no access. This was directly tested: an attempt to modify or delete an existing entry affects zero rows, confirmed against the actual row state, not just the absence of an error.

## Consent and PHI capture

Any UI that captures PHI (ID scans, insurance card scans) is wrapped in a `ConsentGate` component that blocks rendering until an active `consent_records` entry exists for that specific action. Consent is enforced structurally in the render tree, not just logged after the fact.

## OCR and image handling

Identity/insurance card scanning runs via Tesseract.js **entirely client-side, in the browser**. The raw image is never transmitted to any server — not ours, not a third party's. This is a stronger position than a typical server-side OCR proxy: there is no network hop at all for the raw image, which also reduces the Business Associate surface (one fewer vendor ever handles raw PHI images) and sidesteps GDPR's international-transfer rules for this specific data flow.

Only extracted text (name, DOB, etc.) — not the image — ever reaches the application, and that data is subject to the same RLS controls as everything else.

## Secrets management

- No API keys or credentials are committed to the repository (verified via history scan).
- `.gitignore` excludes both `.env` and `.env.local*`.
- The Supabase anon key is intentionally public-safe by design — RLS is the real security boundary, not key secrecy.

## Dependency monitoring

- Dependabot (`.github/dependabot.yml`) checks for dependency and GitHub Actions updates weekly.
- CI runs `npm audit` on every push (informational currently — flags issues in the job log without blocking merges, since not every advisory is exploitable in this app's actual usage pattern; see commit history for a documented example).

## What this document does NOT claim

This document describes *technical* controls. It does not claim regulatory compliance (HIPAA, GDPR, or otherwise) — that requires organizational work this codebase cannot provide on its own: signed Business Associate Agreements with infrastructure vendors, a formal risk assessment, staff training, incident response procedures, and legal review. See `PATH_TO_PRODUCTION.md` for what's still needed before real patient data should touch this system.

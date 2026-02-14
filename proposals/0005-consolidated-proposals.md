# Consolidated Proposals — admin, storage, auth, and E2E

Date: 2026-02-13
Author: GitHub Copilot

---

This document consolidates all proposals mentioned so far (admin-management, AdminPanel upload E2E, admin-auth-questions UI, storage/migration, RLS, tests, docs). Each section is a self-contained proposal with scope, tasks, acceptance criteria, estimate, risk, dependencies and recommended order.

---

## Proposal 1 — Admin-management UI (invite / promote / remove admins)
Goal
- Provide a secure UI so existing admins can add, remove and promote admin users (manage `public.admins`).

Scope / Tasks
1. Add `Admin Management` page inside Admin Panel (admin-only).  
2. List current admins (UUID + email).  
3. Add actions: Invite user (create Auth user or link existing), Promote existing user (insert into `public.admins`), Demote / Remove admin (delete row).  
4. Confirmations & validation.  
5. Server-side: create RPC for safe admin creation if needed (avoid direct client SQL).

Acceptance criteria
- Existing admin can add/remove admins via UI; changes reflected in DB and enforced by RLS immediately.  
- No secrets or hashes exposed in UI.  
- Audit/log (basic) for admin changes.

Estimate: 4–6 hours
Risk: Low
Dependencies: Supabase Auth + `public.admins` (exists), RLS already applied.
Priority: High (enables self-service admin management)

---

## Proposal 2 — AdminPanel upload E2E (complete & automated)
Goal
- Ensure AdminPanel upload flow is fully functional for signed-in admins, with signed URLs and storage cleanup; add automated tests.

Scope / Tasks
1. Finish client UX for file upload (progress, error handling, fallback).  
2. Ensure `storage_path` is saved in `photos` table and signed URL created for display.  
3. Deletion removes object from storage and DB.  
4. Add automated test scripts that sign in, upload file, verify object exists, fetch signed URL, then delete object and DB row.  
5. Add CI-friendly test (scriptable) or local test instructions.

Acceptance criteria
- Signed-in admin can upload/delete from browser; signed URL is returned and image displays.  
- Automated test scripts pass locally/CI.

Estimate: 3–5 hours
Risk: Medium (depends on storage policies & RLS timing)
Dependencies: Storage policies allowing authenticated-admin inserts/deletes; `public.admins` membership.
Priority: High

---

## Proposal 3 — Admin-auth-questions management UI
Goal
- Allow admins to manage the security questions (labels/placeholders) and rotate answers safely without exposing plaintext.

Scope / Tasks
1. Add small UI under Admin Panel to list questions and their metadata (key/label/placeholder/type).  
2. Allow editing label/placeholder/type (no exposure of hashed answers).  
3. Provide secure server-side RPC or SQL to update the hashed answer (accepts plaintext, stores using `crypt(..., gen_salt('bf'))`).  
4. Add validation and confirmation.

Acceptance criteria
- Admin can update questions and change answers via an admin-only UI; server stores hashed answers only.  
- Client never receives hashes.

Estimate: 2–4 hours
Risk: Low
Dependencies: `admin_auth_questions` table + `verify_admin_answers` RPC.
Priority: Medium

---

## Proposal 4 — Storage & migration (data-URL → storage)
Goal
- Migrate existing DB-stored data-URLs to the private `photos` bucket and update `storage_path` (optional/one-time). Ensure storage RLS covers browser uploads.

Scope / Tasks
1. Provide `scripts/migrate-dataurls-to-storage.js` (exists).  
2. Run migration with service-role key.  
3. Update `photos` rows: set `storage_path` and replace `src` with signed URL.  
4. Clean up stale / orphaned objects.

Acceptance criteria
- No remaining data‑URL images in `photos.src`.  
- All migrated rows have `storage_path` and use signed URLs for client display.

Estimate: 1–2 hours (mostly operational)
Risk: Low (requires service-role key & careful cleanup)
Dependencies: `photos` bucket (private), service-role key.
Priority: Low→Medium (one-time)

---

## Proposal 5 — RLS & auth hardening (finalize policies)
Goal
- Tighten RLS and storage policies so only authenticated admins can modify data; document recommended policies.

Scope / Tasks
1. Confirm table-level RLS for `photos`, `milestones`, `site_settings`, `admin_auth_questions` (done).  
2. Ensure storage policies allow only authenticated admins to INSERT/DELETE on `storage.objects` for `photos` bucket.  
3. Add RLS on `public.admins` to restrict writes to existing admins or service-role RPC.  
4. Document recommended policy SQL and how to apply.

Acceptance criteria
- Public read allowed; all writes require admin membership.  
- Storage allows browser upload only to authenticated admins.

Estimate: 1–2 hours
Risk: Medium (policy misconfiguration can lock out admins) — always keep a service-role key available and rotate after.
Dependencies: Supabase project owner privileges to apply policies.
Priority: Critical

---

## Proposal 6 — E2E tests & CI
Goal
- Add automated tests that exercise: sign-in → verify RPC → upload to storage → verify signed URL → delete object → DB cleanup.

Scope / Tasks
1. Add test scripts (node) used during development (`scripts/test-admin-flow.js`, `scripts/test-storage-auth-upload.js`).  
2. Wrap into a CI job (optional) that runs on protected branches using service-role secrets.  
3. Add test assertions and failure alerts.

Acceptance criteria
- Tests run locally and in CI; failures surface clearly.  
- E2E test coverage for admin upload flow.

Estimate: 3–6 hours (including CI setup)
Risk: Medium (requires secure storage of service-role key in CI secrets)
Dependencies: Service-role key for CI (store in secrets).
Priority: Medium

---

## Implementation order (recommended)
1. RLS & auth hardening (Proposal 5) — ensure policies stable.  
2. Admin-management UI (Proposal 1) — so you can manage admins from the app.  
3. AdminPanel upload E2E (Proposal 2) — complete upload UX + automated tests.  
4. Admin-auth-questions UI (Proposal 3).  
5. Storage & migration (Proposal 4) — one-time migration with service-role key.  
6. E2E tests & CI (Proposal 6).

---

## Decision request (pick one)
- A — Start with **Admin-management UI (Proposal 1)** (recommended).  
- B — Start with **AdminPanel upload E2E (Proposal 2)** (finish user-facing uploads first).  

Reply A or B and I’ll create a detailed implementation checklist and open PR-ready changes.

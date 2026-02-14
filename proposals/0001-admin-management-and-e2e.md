# Proposal 0001 — Admin management UI & AdminPanel upload E2E

Date: 2026-02-13
Author: GitHub Copilot

---

## Goal
Provide secure admin management and verify full AdminPanel upload functionality so only authenticated admins can CRUD data and upload photos to the private `photos` bucket.

## Options (choose one)

- Option A — Implement **Admin-management UI** (recommended first)
  - Tasks:
    1. Add `Admin Management` page under the Admin Panel (visible only to admins).
    2. UI to: list admins, invite admin (create Auth user or copy existing user UUID), promote/demote, remove admin.
    3. Server-side: use `public.admins` table (already created) for membership.
    4. Add client-side validation + confirm flows.
  - Acceptance criteria:
    - An existing admin can add/remove other admins via UI.
    - Changes are reflected in `public.admins` and enforce RLS immediately.
    - No plaintext secrets exposed.
  - Estimate: 4–6 hours
  - Risk: low — RLS already in place; major task is UI + small server calls.

- Option B — Finish **AdminPanel upload E2E** (test + harden)
  - Tasks:
    1. Wire AdminPanel upload flow to require signed-in admin (already started).
    2. Add client tests / manual test checklist for: upload → storage, signed URL generation, delete object, `storage_path` persistence.
    3. Add UI feedback for upload failures & retry.
    4. Add automated integration test script to run signed-in upload + cleanup.
  - Acceptance criteria:
    - Browser upload succeeds for signed-in admin and file appears in `photos` bucket with `storage_path` saved.
    - Signed URL works and expires as configured.
    - Deleting photo removes object from storage and DB row.
  - Estimate: 3–5 hours
  - Risk: medium — depends on RLS/storage policies and auth state handling.

## Recommended next step
Start with **Option A (Admin-management UI)** so admins can self-manage access. After admin management is in place, complete Option B (E2E uploads) and add automated tests.

## If you approve
- Reply with the option letter (A or B). I will:
  - Create an implementation proposal (detailed subtasks + PR plan).  
  - Start the work and update the `proposals/` folder with progress files.

---

File: `proposals/0001-admin-management-and-e2e.md`
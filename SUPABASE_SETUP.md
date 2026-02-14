## Supabase quick reference — credentials, admin bootstrap, and storage policy

### Where to put credentials
- Use the project root `.env` file (ignored by git). Required vars used by this project:
  - VITE_SUPABASE_URL
  - VITE_SUPABASE_ANON_KEY
  - SUPABASE_SERVICE_ROLE_KEY (only for local scripts/migrations — **keep secret**)

Example (.env):

VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....

> Important: never commit `.env` to source control (it's listed in `.gitignore`). Rotate the service-role key after any exposure.

---

### Where to put the *initial admin user* (for Option A later)
You can create an initial admin in two ways:

1. Dashboard (manual)
   - Supabase → Authentication → Users → **Create new user** (set email + password).
   - Note the user's `id` (UUID) shown in the user row.
   - SQL (SQL editor) — add to admins table:
     ```sql
     INSERT INTO public.admins (id) VALUES ('<auth_user_id>');
     ```

2. Script (automated)
   - Use the helper script (requires service-role key in env):
     SERVICE_ROLE_KEY="<service-role>" node scripts/create-admin-user.js
   - Script will create `admin+local@example.com` and insert it into `public.admins` (useful for testing).

Recommendation: create an Auth user in the Dashboard and insert their UUID into `public.admins`. We'll add an Admin-management UI later so you can do this from the app.

---

### Why we have both `admin_auth_questions` and `admin_auth_questions_public`
- `admin_auth_questions` (table): stores the security questions and **bcrypt-hashed answers** (server-side only). The answers are never exposed to the client.
- `admin_auth_questions_public` (VIEW): exposes only `key`, `label`, `placeholder`, and `type` so the client can render the questions without seeing any hashes or answers.

Security rationale: client must be able to render the questions, but verification happens server-side via `verify_admin_answers(jsonb)` which compares submitted answers against stored hashes.

---

### Why `public.admins` is a minimal UUID-only table
- Purpose: fast membership check (is this signed-in user an admin?) used by RLS and UI.
- Minimal surface area intentionally — membership is the single source of truth for admin rights.
- Current state: `public.admins` has one seeded row (bootstrap). **Writes should be restricted** via RLS or admin-only UI — we will add an admin-management UI (Option A) which will manage `public.admins` safely.

Security note: right now `public.admins` exists and can be queried by the app; we will add RLS on it (restrict writes) as part of Option A.

---

### Enable browser uploads for signed-in admins (finish Option B)
Browser uploads to the private `photos` bucket require a storage policy that allows authenticated admin users to INSERT/DELETE objects.

Recommended SQL (run in Supabase SQL editor as project owner):

```sql
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE POLICY storage_insert_admin ON storage.objects
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM public.admins a WHERE a.id = auth.uid())
  );

CREATE POLICY storage_delete_admin ON storage.objects
  FOR DELETE USING (
    auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM public.admins a WHERE a.id = auth.uid())
  );
```

Or via Dashboard UI:
- Supabase → Storage → Buckets → `photos` → Policies → Add `Insert` policy and `Delete` policy using the expression above.

After adding these policies:
- Signed-in admins can upload/delete objects from the browser.  
- Run: `node scripts/test-storage-auth-upload.js` (or sign in and use the Admin Panel) to verify.

---

### Quick checklist for you to complete Option B right now
1. Create or confirm an admin Auth user (Dashboard) and insert UUID into `public.admins` (or use `scripts/create-admin-user.js`).
2. Add the storage policies above in the SQL editor or Storage → Policies UI.
3. Sign in via the app and try uploading a photo in the Admin Panel. I will re-run tests and mark E2E done.

If you want, I can add the Admin-management UI next so you can manage `public.admins` from the app (Option A).

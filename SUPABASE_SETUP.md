## Supabase setup & next steps

What I completed:
- Created `photos`, `milestones`, and `site_settings` tables and seeded initial data.
- Wired the front-end to read `photos`, `milestones` and `relationship_start_date` from the DB.
- Updated the Admin Panel so metadata CRUD persists to the `photos` table.

Remaining (manual) step — **create a private Storage bucket**:
1. Open your Supabase project → Storage → Buckets → Create a bucket.
2. Name: `photos` — **Privacy**: _Private_.
3. Save.

Why you need to do this manually
- The publishable/anon key does not have privileges to create buckets (service-role required). Once the bucket exists, the AdminPanel upload code will try to store files there and then save signed URLs in the DB.

Recommended RLS (after you enable Auth):
- Allow public SELECT on `photos` & `milestones` but restrict INSERT/UPDATE/DELETE to authenticated admin users.

Example policy snippets (apply after you enable Auth and add an `admins` claim or table):

-- Allow public read
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_select_photos" ON public.photos FOR SELECT USING (true);

-- Allow writes only for authenticated (example; adapt to your admin claim)
CREATE POLICY "authenticated_modify_photos" ON public.photos FOR INSERT, UPDATE, DELETE TO authenticated USING (auth.role() = 'authenticated');


How to test locally (quick):
- Start dev server: `npm run dev` (already wired to DB via `.env`).
- Visit the app and open Admin Panel (you need to pass the memory-based auth questions). Try:
  - Editing a photo title → persists to DB.
  - Adding a photo (choose a file) → UI will fall back to data-URL if `photos` bucket is missing; once bucket exists uploads will be stored there.

If you want, I can:
- Create the bucket for you if you provide a service-role key (not recommended to store in repo).
- Or I can guide you through creating the bucket in the Supabase dashboard (2 clicks).

Next small step I suggest: create the private `photos` bucket in the dashboard so I can finish E2E for uploads + then add RLS.

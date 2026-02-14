import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rsilsqauaawyolqrrxmm.supabase.co';
const SUPABASE_ANON = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_e_nq-ALYHeTkkipEVKxW1A_orI_MlSe';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

async function fetchHead(url) {
  const res = await fetch(url, { method: 'HEAD' });
  return res.ok;
}

(async () => {
  console.log('E2E: sign in as admin...');
  const email = process.env.E2E_ADMIN_EMAIL || 'admin+local@example.com';
  const password = process.env.E2E_ADMIN_PASSWORD || 'Test1234!';

  try {
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signInErr) throw signInErr;
    const userId = signInData.user?.id;
    console.log('signed in user id:', userId);

    // upload a local file (README.md) via authenticated session
    console.log('E2E: uploading file to storage as signed-in admin...');
    const filePath = path.join(process.cwd(), 'README.md');
    const stream = fs.createReadStream(filePath);
    const dest = `e2e/${Date.now()}_readme.md`;

    const { data: uploadData, error: uploadErr } = await supabase.storage.from('photos').upload(dest, stream);
    if (uploadErr) throw uploadErr;
    console.log('uploadData:', uploadData);

    // create signed url
    const { data: signed, error: signedErr } = await supabase.storage.from('photos').createSignedUrl(dest, 60 * 60);
    if (signedErr) throw signedErr;
    const signedUrl = signed.signedUrl;
    console.log('signedUrl created (first 120 chars):', signedUrl.slice(0, 120));

    // insert photo row referencing storage_path
    console.log('E2E: inserting photos row referencing storage_path...');
    const photo = {
      src: signedUrl,
      storage_path: dest,
      title: 'E2E Uploaded Photo',
      date: new Date().toISOString().split('T')[0],
      location: 'E2E Test'
    };
    const { data: insertData, error: insertErr } = await supabase.from('photos').insert(photo).select();
    if (insertErr) throw insertErr;
    const inserted = Array.isArray(insertData) ? insertData[0] : insertData;
    console.log('inserted photo id:', inserted.id);

    // verify signed url is reachable (HEAD)
    console.log('E2E: verifying signed URL reachable...');
    const ok = await fetchHead(signedUrl);
    if (!ok) throw new Error('Signed URL not reachable (non-200)');
    console.log('signed URL reachable ✅');

    // verify DB row has storage_path
    const { data: fetched, error: fetchErr } = await supabase.from('photos').select('id,storage_path,src').eq('id', inserted.id).maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!fetched || !fetched.storage_path) throw new Error('DB row missing storage_path');
    console.log('DB row has storage_path ->', fetched.storage_path);

    // cleanup: delete storage object and DB row
    console.log('E2E: cleaning up (delete storage object + DB row)...');
    const { error: delStorageErr } = await supabase.storage.from('photos').remove([dest]);
    if (delStorageErr) throw delStorageErr;
    const { error: delDbErr } = await supabase.from('photos').delete().eq('id', inserted.id);
    if (delDbErr) throw delDbErr;

    console.log('E2E: cleanup complete — all checks passed ✅');
    process.exit(0);
  } catch (err) {
    console.error('E2E test failed:', err);
    process.exit(1);
  }
})();
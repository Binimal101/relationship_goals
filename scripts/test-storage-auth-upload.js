import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rsilsqauaawyolqrrxmm.supabase.co';
const SUPABASE_ANON = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_e_nq-ALYHeTkkipEVKxW1A_orI_MlSe';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

(async () => {
  try {
    const email = 'admin+local@example.com';
    const password = 'Test1234!';

    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signInErr) throw signInErr;
    console.log('signed in, user id:', signInData.user?.id);

    const filePath = path.join(process.cwd(), 'README.md');
    const file = fs.createReadStream(filePath);
    const dest = `auth_test_${Date.now()}.md`;

    const { data: uploadData, error: uploadErr } = await supabase.storage.from('photos').upload(dest, file);
    console.log('uploadErr:', uploadErr);
    console.log('uploadData:', uploadData);

    if (uploadErr) process.exit(1);

    const { data: signed, error: signedErr } = await supabase.storage.from('photos').createSignedUrl(dest, 60 * 60);
    console.log('signedErr:', signedErr);
    console.log('signed:', signed);

    // cleanup
    const { error: delErr } = await supabase.storage.from('photos').remove([dest]);
    console.log('remove error:', delErr);

  } catch (err) {
    console.error('storage-auth-upload failed', err);
    process.exit(1);
  }

  process.exit(0);
})();
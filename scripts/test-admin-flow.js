import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rsilsqauaawyolqrrxmm.supabase.co';
const SUPABASE_ANON = process.env.SUPABASE_ANON || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_e_nq-ALYHeTkkipEVKxW1A_orI_MlSe';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

(async () => {
  try {
    const email = 'admin+local@example.com';
    const password = 'Test1234!';

    // sign in
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signInErr) throw signInErr;
    console.log('signed in, user id:', signInData.user?.id);

    // verify questions
    const answers = {
      hisBirthday: '02/25/2005',
      herBirthday: '01/10/2001',
      anniversary: '03/24/2025',
      firstPlace: 'wawa'
    };
    const { data: verifyData, error: verifyErr } = await supabase.rpc('verify_admin_answers', { answers });
    if (verifyErr) throw verifyErr;
    console.log('verify_admin_answers ->', verifyData);

    // check admin membership
    const userId = signInData.user?.id;
    const { data: adminRow, error: adminErr } = await supabase.from('admins').select('id').eq('id', userId).maybeSingle();
    if (adminErr) throw adminErr;
    console.log('adminRow ->', adminRow);

    // attempt to insert a photo (should succeed for admins)
    const photo = { src: 'https://example.com/x.jpg', title: 'Auth Test', date: '2026-02-13' };
    const { data: insertData, error: insertErr } = await supabase.from('photos').insert(photo).select();
    if (insertErr) throw insertErr;
    console.log('insert photo ->', insertData);

    // cleanup: delete inserted photo if created
    if (insertData && insertData.length) {
      const id = insertData[0].id;
      const { error: delErr } = await supabase.from('photos').delete().eq('id', id);
      if (delErr) console.warn('cleanup delete error', delErr);
      else console.log('cleanup: deleted inserted photo', id);
    }

  } catch (err) {
    console.error('test-admin-flow failed', err);
  } finally {
    process.exit(0);
  }
})();
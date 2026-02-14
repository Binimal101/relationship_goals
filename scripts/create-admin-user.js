import { createClient } from '@supabase/supabase-js';

// Usage: set SUPABASE_URL and SERVICE_ROLE_KEY in env then run
// node scripts/create-admin-user.js

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rsilsqauaawyolqrrxmm.supabase.co';
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE_KEY) {
  console.error('Please set SERVICE_ROLE_KEY env var (service role key required)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

(async () => {
  try {
    const email = 'admin+local@example.com';
    const password = 'Test1234!';

    // create user via admin API
    let userData = null;
    const res = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
    console.log('createUser response', res);
    const createErr = res && res.error ? res.error : null;
    if (createErr && createErr.code === 'email_exists') {
      // user exists already — find it
      const listRes = await supabase.auth.admin.listUsers();
      console.log('listUsers response', listRes);
      const listData = listRes && listRes.data ? listRes.data : null;
      if (!listData) throw new Error('could not list users');
      // listData is an array of users
      userData = Array.isArray(listData) ? listData.find(u => u.email === email) : (listData.users || []).find(u => u.email === email);
      if (!userData) throw new Error('user exists but could not be fetched');
    } else if (createErr) {
      throw createErr;
    } else {
      userData = res && res.data ? res.data : res && res.user ? res.user : null;
    }

    console.log('resolved user id:', userData?.id);

    // insert into admins (ignore conflict)
    const { error: adminErr } = await supabase.from('admins').insert({ id: userData.id }, { upsert: false });
    if (adminErr && adminErr.code !== '23505') throw adminErr;

    console.log('inserted admin record for user:', email);
    console.log('credentials ->', { email, password });
  } catch (err) {
    console.error('failed to create admin user', err);
  } finally {
    process.exit(0);
  }
})();
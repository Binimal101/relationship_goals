import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rsilsqauaawyolqrrxmm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_e_nq-ALYHeTkkipEVKxW1A_orI_MlSe';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

(async () => {
  try {
    const res = await supabase.storage.createBucket('photos', { public: false });
    console.log('createBucket res:', res);
  } catch (err) {
    console.error('create bucket error', err);
  } finally {
    process.exit(0);
  }
})();
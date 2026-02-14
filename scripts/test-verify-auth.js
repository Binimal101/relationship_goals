import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rsilsqauaawyolqrrxmm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_e_nq-ALYHeTkkipEVKxW1A_orI_MlSe';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

(async () => {
  try {
    const answers = {
      hisBirthday: '02/25/2005',
      herBirthday: '01/10/2001',
      anniversary: '03/24/2025',
      firstPlace: 'wawa'
    };

    const { data, error } = await supabase.rpc('verify_admin_answers', { answers });
    if (error) {
      console.error('rpc error', error);
      process.exit(1);
    }
    console.log('verify_admin_answers ->', data);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
})();
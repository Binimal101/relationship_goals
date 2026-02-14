import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rsilsqauaawyolqrrxmm.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || 'sb_publishable_e_nq-ALYHeTkkipEVKxW1A_orI_MlSe';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

(async () => {
  try {
    const path = '1771051606326_IMG_3678.jpeg';
    const { data, error } = await supabase.storage.from('photos').createSignedUrl(path, 60 * 60);
    console.log('signed url error:', error);
    console.log('signed url:', data?.signedUrl);

    if (data?.signedUrl) {
      const res = await fetch(data.signedUrl);
      console.log('fetch status:', res.status);
      console.log('content-type:', res.headers.get('content-type'));
    }

    // also attempt a direct download (anon client) to verify access
    try {
      const { data: dl, error: dlErr } = await supabase.storage.from('photos').download(path);
      console.log('download error:', dlErr);
      console.log('download data type:', dl ? typeof dl : null);
    } catch (err) {
      console.error('download exception', err);
    }
  } catch (err) {
    console.error('error', err);
  } finally {
    process.exit(0);
  }
})();
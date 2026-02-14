import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rsilsqauaawyolqrrxmm.supabase.co';
const SUPABASE_KEY = process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_publishable_e_nq-ALYHeTkkipEVKxW1A_orI_MlSe';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

(async () => {
  try {
    const filePath = path.join(process.cwd(), 'README.md');
    const file = fs.createReadStream(filePath);
    const storagePath = `test_upload_${Date.now()}.md`;
    const { data, error } = await supabase.storage.from('photos').upload(storagePath, file);
    console.log('upload result error:', error);
    console.log('upload result data:', data);

    const { data: signed, error: signedErr } = await supabase.storage.from('photos').createSignedUrl(storagePath, 60 * 60);
    console.log('createSignedUrl error:', signedErr);
    console.log('signedUrl data:', signed);

    // cleanup
    const { error: delErr } = await supabase.storage.from('photos').remove([storagePath]);
    console.log('remove error:', delErr);
  } catch (err) {
    console.error('test-storage-upload exception', err);
  } finally {
    process.exit(0);
  }
})();
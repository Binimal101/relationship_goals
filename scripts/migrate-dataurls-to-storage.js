import { createClient } from '@supabase/supabase-js';

// Usage: set env SERVICE_ROLE_KEY and SUPABASE_URL, then run
// SERVICE_ROLE_KEY=<key> SUPABASE_URL=<url> node scripts/migrate-dataurls-to-storage.js

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rsilsqauaawyolqrrxmm.supabase.co';
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY;
if (!SERVICE_ROLE_KEY) {
  console.error('Please set SERVICE_ROLE_KEY env var (service role key required)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function parseDataUrl(dataUrl) {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) return null;
  return { mime: match[1], data: Buffer.from(match[2], 'base64') };
}

(async () => {
  try {
    const { data: rows, error } = await supabase.from('photos').select('id, src').is('storage_path', null).limit(100);
    if (error) throw error;
    if (!rows || rows.length === 0) {
      console.log('No candidate rows found');
      return;
    }

    for (const row of rows) {
      const { id, src } = row;
      if (!src || !src.startsWith('data:')) continue;
      const parsed = parseDataUrl(src);
      if (!parsed) { console.warn('invalid data url for id', id); continue; }

      const ext = parsed.mime.split('/')?.[1] || 'bin';
      const path = `migrated/${id}_${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('photos').upload(path, parsed.data, { upsert: true });
      if (uploadErr) { console.error('uploadErr', uploadErr); continue; }

      const { data: signed, error: signedErr } = await supabase.storage.from('photos').createSignedUrl(path, 60 * 60 * 24 * 7);
      if (signedErr) { console.error('signedErr', signedErr); continue; }

      const { error: updateErr } = await supabase.from('photos').update({ storage_path: path, src: signed.signedUrl }).eq('id', id);
      if (updateErr) { console.error('updateErr', updateErr); continue; }

      console.log('migrated id', id, '->', path);
    }
  } catch (err) {
    console.error('migration failed', err);
  }
})();
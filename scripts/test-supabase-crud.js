import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rsilsqauaawyolqrrxmm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_e_nq-ALYHeTkkipEVKxW1A_orI_MlSe';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

(async () => {
  try {
    const { data: before } = await supabase.from('photos').select('id');
    console.log('photos count before:', Array.isArray(before) ? before.length : 0);

    const photo = { src: 'https://example.com/test.jpg', title: 'E2E Test Photo', date: '2026-02-13', location: 'Test', description: 'test', favorite: false };
    const { data: insertData, error: insertError } = await supabase.from('photos').insert(photo).select();
    if (insertError) throw insertError;
    console.log('inserted:', insertData);

    const id = insertData?.[0]?.id;
    if (id) {
      const { data: updateData, error: updateError } = await supabase.from('photos').update({ title: 'E2E Test Photo (updated)' }).eq('id', id).select();
      if (updateError) throw updateError;
      console.log('updated:', updateData);

      const { error: deleteError } = await supabase.from('photos').delete().eq('id', id);
      if (deleteError) throw deleteError;
      console.log('deleted id', id);
    }

    const { data: after } = await supabase.from('photos').select('id');
    console.log('photos count after:', Array.isArray(after) ? after.length : 0);
  } catch (err) {
    console.error('test failed:', err);
  } finally {
    process.exit(0);
  }
})();
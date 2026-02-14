import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env manually
const envPath = path.join(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  if (line.includes('=') && !line.startsWith('#')) {
    const [key, val] = line.split('=');
    env[key.trim()] = val.trim().replace(/^["']|["']$/g, '');
  }
});

const SUPABASE_URL = env.VITE_SUPABASE_URL || 'https://rsilsqauaawyolqrrxmm.supabase.co';
const ANON_KEY = env.VITE_SUPABASE_ANON_KEY || '';

if (!ANON_KEY) {
  console.error('VITE_SUPABASE_ANON_KEY is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, ANON_KEY);

(async () => {
  try {
    const path = '1771051606326_IMG_3678.jpeg';
    console.log(`Testing createSignedUrl with ANON_KEY on: ${path}`);
    const { data, error } = await supabase.storage.from('photos').createSignedUrl(path, 60 * 60);
    
    if (error) {
      console.error('createSignedUrl error:', error.message, 'status:', error.status);
    } else {
      console.log('createSignedUrl SUCCESS');
      console.log('signed url:', data?.signedUrl);
    }
  } catch (err) {
    console.error('Exception:', err.message);
  } finally {
    process.exit(0);
  }
})();

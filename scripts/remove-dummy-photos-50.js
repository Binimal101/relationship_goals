import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MANIFEST_PATH = path.join(__dirname, 'dummy-photos-50-manifest.json');
const CONFIG_PATH = path.join(__dirname, '..', 'config.yaml');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://rsilsqauaawyolqrrxmm.supabase.co';
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_e_nq-ALYHeTkkipEVKxW1A_orI_MlSe';
const BATCH_MARKER = '__DUMMY_PHOTO_BATCH_50_V1__';
const BATCH_SIZE = 50;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function getCredentials() {
  const fromEnv = {
    email: process.env.SUPABASE_EMAIL,
    password: process.env.SUPABASE_PASSWORD,
  };
  if (fromEnv.email && fromEnv.password) return fromEnv;

  if (!fs.existsSync(CONFIG_PATH)) return null;
  const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
  const cfg = yaml.load(raw);
  const email = cfg?.email;
  const password = cfg?.password;
  if (email && password) return { email, password };
  return null;
}

(async () => {
  try {
    const credentials = getCredentials();
    if (credentials && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { error: signInError } = await supabase.auth.signInWithPassword(credentials);
      if (signInError) throw signInError;
      console.log('Authenticated as admin user for RLS-protected delete.');
    }

    if (!fs.existsSync(MANIFEST_PATH)) {
      console.error('Manifest not found. Nothing to remove.');
      console.error('Expected manifest at:', MANIFEST_PATH);
      process.exit(1);
    }

    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    const ids = Array.isArray(manifest?.ids) ? manifest.ids : [];

    if (manifest?.marker !== BATCH_MARKER) {
      throw new Error(`Manifest marker mismatch. Expected ${BATCH_MARKER}, got ${manifest?.marker}`);
    }

    if (ids.length !== BATCH_SIZE) {
      throw new Error(`Manifest id count mismatch. Expected ${BATCH_SIZE}, got ${ids.length}`);
    }

    const { data: checkRows, error: checkErr } = await supabase
      .from('photos')
      .select('id,description')
      .in('id', ids);

    if (checkErr) throw checkErr;

    if (!Array.isArray(checkRows) || checkRows.length !== BATCH_SIZE) {
      throw new Error(`Safety check failed: expected ${BATCH_SIZE} matching rows, found ${Array.isArray(checkRows) ? checkRows.length : 0}`);
    }

    const notMarked = checkRows.filter((r) => !String(r.description || '').includes(BATCH_MARKER));
    if (notMarked.length > 0) {
      throw new Error(`Safety check failed: ${notMarked.length} rows do not contain marker. Aborting delete.`);
    }

    const { data: deletedRows, error: deleteErr } = await supabase
      .from('photos')
      .delete()
      .in('id', ids)
      .select('id');

    if (deleteErr) throw deleteErr;

    if (!Array.isArray(deletedRows) || deletedRows.length !== BATCH_SIZE) {
      throw new Error(`Delete count mismatch. Expected ${BATCH_SIZE}, deleted ${Array.isArray(deletedRows) ? deletedRows.length : 0}`);
    }

    fs.unlinkSync(MANIFEST_PATH);

    console.log(`Removed exactly ${BATCH_SIZE} dummy photos.`);
    console.log('Removed manifest:', MANIFEST_PATH);
  } catch (err) {
    console.error('Failed to remove dummy photos:', err);
    process.exit(1);
  }
})();

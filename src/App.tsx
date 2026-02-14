import { useState, useEffect, useRef, useMemo } from 'react';
import { Heart, Calendar, Camera, MapPin, Star, Clock, Lock, Settings, Plus, Trash2, Edit2, GripVertical, X, Check, Upload, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';

// Photo data structure
interface Photo {
  id: number;
  src: string; // runtime URL used for <img> (may be signed URL)
  storage_path?: string | null; // path in private `photos` bucket when uploaded
  title: string;
  date: string;
  location: string;
  description: string;
  favorite?: boolean;
  lat?: number;
  lng?: number;
}

// Helper: detect Supabase storage signed URLs and extract storage_path
const SUPABASE_SIGNED_URL_RE = /\/storage\/v1\/object\/sign\/photos\/([^?]+)/;

function extractStoragePathFromSignedUrl(url?: string): string | null {
  if (!url) return null;
  const m = url.match(SUPABASE_SIGNED_URL_RE);
  return m ? decodeURIComponent(m[1]) : null;
}

// Milestone data structure
interface Milestone {
  id: number;
  date: string;  // ISO date string (YYYY-MM-DD)
  title: string;
  description: string;
  icon: React.ReactNode;
  icon_name?: string;  // persisted icon name for DB milestones
}

// Map icon name strings to Lucide components
const MILESTONE_ICONS: Record<string, React.ReactNode> = {
  heart: <Heart className="w-5 h-5" />,
  star: <Star className="w-5 h-5" />,
  calendar: <Calendar className="w-5 h-5" />,
  camera: <Camera className="w-5 h-5" />,
  clock: <Clock className="w-5 h-5" />,
  mappin: <MapPin className="w-5 h-5" />,
  check: <Check className="w-5 h-5" />,
};

const MILESTONE_ICON_NAMES = Object.keys(MILESTONE_ICONS);

function iconFromName(name?: string): React.ReactNode {
  return MILESTONE_ICONS[name || 'heart'] || <Heart className="w-5 h-5" />;
}

// Auth questions (no plaintext answers — now stored hashed in DB)
interface AuthQuestion {
  id: string; // corresponds to `key` in DB
  label: string;
  placeholder?: string;
  type: 'date' | 'text';
}

// local fallback (labels/placeholders only) — answers are NOT stored here
const fallbackAuthQuestions: AuthQuestion[] = [
  { id: 'hisBirthday', label: 'His Birthday', placeholder: 'MM/DD/YYYY', type: 'date' },
  { id: 'herBirthday', label: 'Her Birthday', placeholder: 'MM/DD/YYYY', type: 'date' },
  { id: 'anniversary', label: 'Our Anniversary', placeholder: 'MM/DD/YYYY', type: 'date' },
  { id: 'firstPlace', label: 'The First Place We Went To', placeholder: 'Enter the place...', type: 'text' },
];

// Sample photos data with coordinates
const initialPhotos: Photo[] = [
  {
    id: 1,
    src: "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=800&q=80",
    title: "Our First Date",
    date: "2023-01-15",
    location: "Coffee Shop Downtown",
    description: "Where it all began. I was so nervous, but you made everything feel so natural.",
    favorite: true,
    lat: 40.7128,
    lng: -74.0060
  },
  {
    id: 2,
    src: "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=800&q=80",
    title: "Sunset Walk",
    date: "2023-02-20",
    location: "Beach Boardwalk",
    description: "Walking hand in hand as the sun painted the sky in beautiful colors.",
    favorite: true,
    lat: 34.0195,
    lng: -118.4912
  },
  {
    id: 3,
    src: "https://images.unsplash.com/photo-1519741497674-611481863552?w=800&q=80",
    title: "Anniversary Dinner",
    date: "2023-06-15",
    location: "Rooftop Restaurant",
    description: "Celebrating our love with candlelight and your beautiful smile.",
    favorite: true,
    lat: 40.7580,
    lng: -73.9855
  },
  {
    id: 4,
    src: "https://images.unsplash.com/photo-1523438885200-e635ba2c371e?w=800&q=80",
    title: "Weekend Getaway",
    date: "2023-08-10",
    location: "Mountain Cabin",
    description: "Cozy moments together, away from the world. Just us.",
    favorite: false,
    lat: 35.6532,
    lng: -83.5070
  },
  {
    id: 5,
    src: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800&q=80",
    title: "Autumn Picnic",
    date: "2023-10-05",
    location: "Central Park",
    description: "Fall leaves and your laughter - the perfect afternoon.",
    favorite: false,
    lat: 40.7829,
    lng: -73.9654
  },
  {
    id: 6,
    src: "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=800&q=80",
    title: "Winter Wonderland",
    date: "2023-12-20",
    location: "Snow Resort",
    description: "Keeping each other warm in the coldest days.",
    favorite: true,
    lat: 44.2795,
    lng: -73.9799
  },
  {
    id: 7,
    src: "https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=800&q=80",
    title: "Spring Festival",
    date: "2024-03-15",
    location: "Botanical Garden",
    description: "Flowers blooming, just like our love continues to grow.",
    favorite: false,
    lat: 40.8636,
    lng: -73.8786
  },
  {
    id: 8,
    src: "https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?w=800&q=80",
    title: "Movie Night",
    date: "2024-05-01",
    location: "Home Sweet Home",
    description: "Cuddled up on the couch, your head on my shoulder.",
    favorite: false,
    lat: 40.7128,
    lng: -74.0060
  }
];

// Milestones data
const milestones: Milestone[] = [
  {
    id: 1,
    date: "January 15, 2023",
    title: "The Day We Met",
    description: "That magical moment when our eyes first met and I knew something special was beginning.",
    icon: <Heart className="w-5 h-5" />
  },
  {
    id: 2,
    date: "March 1, 2023",
    title: "First 'I Love You'",
    description: "The words that changed everything. My heart still skips a beat remembering that moment.",
    icon: <Star className="w-5 h-5" />
  },
  {
    id: 3,
    date: "June 15, 2023",
    title: "Our First Anniversary",
    description: "365 days of laughter, growth, and falling more in love with you every single day.",
    icon: <Calendar className="w-5 h-5" />
  },
  {
    id: 4,
    date: "December 25, 2023",
    title: "First Holiday Together",
    description: "Creating new traditions and making memories that will last a lifetime.",
    icon: <Camera className="w-5 h-5" />
  },
  {
    id: 5,
    date: "Today & Forever",
    title: "Our Journey Continues",
    description: "Every day with you is a new adventure. I can't wait to see what the future holds for us.",
    icon: <Clock className="w-5 h-5" />
  }
];

// Time together calculator
function calculateTimeTogether(startDate: Date) {
  const now = new Date();
  const diff = now.getTime() - startDate.getTime();

  const totalSeconds = Math.floor(diff / 1000);
  const totalDays = Math.floor(totalSeconds / (60 * 60 * 24));
  const years = Math.floor(totalDays / 365);
  const days = Math.floor((totalSeconds % (365 * 24 * 60 * 60)) / (24 * 60 * 60));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  // return both the conventional breakdown and totalDays for display
  return { years, days, hours, minutes, seconds, totalDays };
}

// Google Maps libraries (include 'marker' for AdvancedMarkerElement)
const mapLibraries = ["places", "marker"] as const;

// Date formatter - auto formats input to MM/DD/YYYY
function formatDateInput(value: string): string {
  // Remove all non-digits
  const digits = value.replace(/\D/g, '');
  
  if (digits.length === 0) return '';
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
}

// Auth Page Component
function AuthPage({ onAuthSuccess }: { onAuthSuccess: () => void }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  const [questions, setQuestions] = useState<AuthQuestion[] | null>(null);
  const [loadingQuestions, setLoadingQuestions] = useState<boolean>(true);

  // sign-in state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState('');
  const [user, setUser] = useState<any | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingQuestions(true);
      try {
        const { data, error } = await supabase
          .from('admin_auth_questions_public')
          .select('*')
          .order('key', { ascending: true });
        if (error || !data) {
          console.warn('failed to load admin_auth_questions_public from DB, using fallback', error);
          if (mounted) setQuestions(fallbackAuthQuestions);
        } else {
          const mapped = (data as any[]).map(r => ({ id: r.key, label: r.label, placeholder: r.placeholder, type: r.type }));
          if (mounted) setQuestions(mapped);
        }
      } catch (err) {
        console.error('load admin questions error', err);
        if (mounted) setQuestions(fallbackAuthQuestions);
      } finally {
        if (mounted) setLoadingQuestions(false);
      }
    })();

    // keep local auth state in sync
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) setUser(session.user);
      if (event === 'SIGNED_OUT') setUser(null);
    });

    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) setUser(data.user);
    })();

    return () => { mounted = false; listener?.subscription.unsubscribe(); };
  }, []);

  const handleInputChange = (id: string, value: string, type: string) => {
    let formattedValue = value;
    if (type === 'date') formattedValue = formatDateInput(value);
    setAnswers(prev => ({ ...prev, [id]: formattedValue }));
    setError('');
  };

  const signIn = async () => {
    setSigningIn(true);
    setSignInError('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data?.user) setUser(data.user);
    } catch (err: any) {
      setSignInError(err?.message || 'Sign-in failed');
    } finally {
      setSigningIn(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const handleSubmit = async () => {
    if (!questions) return;
    setIsChecking(true);
    setError('');

    // require sign-in first
    const { data: currentUser } = await supabase.auth.getUser();
    const signedInUser = currentUser?.user ?? user;
    if (!signedInUser) {
      setError('You must sign in with your admin account before answering the security questions.');
      setIsChecking(false);
      return;
    }

    // verify answers server-side via RPC (no plaintext stored in client)
    try {
      const normalizedAnswers = { ...answers };
      if (typeof answers.firstPlace === 'string') {
        // compare the first-place answer case-insensitively
        normalizedAnswers.firstPlace = answers.firstPlace.trim().toLowerCase();
      }

      const { data, error } = await supabase.rpc('verify_admin_answers', { answers: normalizedAnswers });
      const ok = data === true || (Array.isArray(data) && data[0] === true);
      if (error) {
        console.error('verify_admin_answers rpc error', error);
        setError('Verification failed — please try again.');
        setIsChecking(false);
        return;
      }
      if (!ok) {
        setError("Some answers don't match our memories... Try again! 💕");
        setIsChecking(false);
        return;
      }

      // answers OK — now check admin membership
      const { data: existingAdmin, error: adminErr } = await supabase.from('admins').select('id').eq('id', signedInUser.id).maybeSingle();
      if (adminErr) {
        console.error('admins.select error', adminErr);
        setError('Authorization check failed.');
        setIsChecking(false);
        return;
      }

      if (existingAdmin) {
        onAuthSuccess();
        setIsChecking(false);
        return;
      }

      // bootstrap: if no admins exist, make this user the first admin
      const { data: anyAdminRows } = await supabase.from('admins').select('id').limit(1);
      if (!anyAdminRows || anyAdminRows.length === 0) {
        const { error: insertErr } = await supabase.from('admins').insert({ id: signedInUser.id });
        if (insertErr) {
          console.error('failed to insert initial admin', insertErr);
          setError('Could not create admin record.');
          setIsChecking(false);
          return;
        }
        onAuthSuccess();
        setIsChecking(false);
        return;
      }

      // user is not an admin
      setError('This account is not authorized as an admin. Ask an existing admin to add you.');
    } catch (err) {
      console.error('verification exception', err);
      setError('Verification failed — please try again.');
    } finally {
      setIsChecking(false);
    }
  };

  const isComplete = (questions ?? fallbackAuthQuestions).every(q => answers[q.id]?.trim()) && !!user;

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-100 via-pink-100 to-rose-200 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-rose-200">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-rose-400 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-rose-500/30">
              <Lock className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gradient mb-2">
              Our Website's Admin Panel
            </h1>
            <p className="text-rose-600/70">Prove it's really you... ❤️</p>
          </div>

          {/* Sign-in with email + password (required) */}
          <div className="space-y-4">
            {!user ? (
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <Label>Email</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@domain.com" />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••••" />
                </div>
                {signInError && <div className="text-sm text-rose-600">{signInError}</div>}
                <div className="flex gap-3">
                  <Button onClick={signIn} disabled={!email || !password || signingIn} className="flex-1 bg-rose-500 text-white">
                    {signingIn ? 'Signing in…' : 'Sign in'}
                  </Button>
                  <Button variant="outline" onClick={() => { setEmail(''); setPassword(''); }} className="flex-1">Clear</Button>
                </div>
                <div className="text-xs text-rose-500">You must sign in with your admin account and then answer the security questions to unlock the admin panel.</div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-rose-600">Signed in as <strong className="ml-1">{user.email}</strong></div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={signOut}>Sign out</Button>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 space-y-5">
            {loadingQuestions ? (
              <div className="text-center text-sm text-rose-500">Loading questions…</div>
            ) : (
              (questions ?? fallbackAuthQuestions).map((q, index) => (
                <div key={q.id} className="space-y-2">
                  <Label className="text-rose-700 font-medium flex items-center gap-2">
                    <span className="w-6 h-6 bg-rose-100 rounded-full flex items-center justify-center text-xs text-rose-600 font-bold">
                      {index + 1}
                    </span>
                    {q.label}
                  </Label>
                  <Input
                    type="text"
                    placeholder={q.placeholder}
                    value={answers[q.id] || ''}
                    maxLength={q.type === 'date' ? 10 : undefined}
                    onChange={(e) => handleInputChange(q.id, e.target.value, q.type)}
                    className="border-rose-200 focus:border-rose-400 focus:ring-rose-400 rounded-xl"
                  />
                </div>
              ))
            )}
          </div>

          {error && (
            <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-sm text-center">
              {error}
            </div>
          )}

          <Button
            onClick={handleSubmit}
            disabled={!isComplete || isChecking}
            className="w-full mt-6 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white py-6 rounded-xl font-medium disabled:opacity-50"
          >
            {isChecking ? (
              <span className="flex items-center gap-2">
                <Heart className="w-5 h-5 animate-pulse" fill="currentColor" />
                Checking our memories...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Heart className="w-5 h-5" fill="currentColor" />
                Unlock Our Memories
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Admin Panel Component
function AdminPanel({ 
  photos, 
  onUpdatePhotos, 
  onClose,
  relationshipStartDate,
  onUpdateRelationshipStartDate,
  milestones: propMilestones,
  onUpdateMilestones,
}: { 
  photos: Photo[]; 
  onUpdatePhotos: (photos: Photo[]) => void;
  onClose: () => void;
  relationshipStartDate?: Date | null;
  onUpdateRelationshipStartDate?: (d: Date) => void;
  milestones: Milestone[];
  onUpdateMilestones: (milestones: Milestone[]) => void;
}) {
  const [localPhotos, setLocalPhotos] = useState<Photo[]>(photos);
  const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Google Places Autocomplete state (new API — no DOM container needed)
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeSuggestions, setPlaceSuggestions] = useState<{ placeId: string; description: string; toPlace: () => any }[]>([]);
  const [showPlaceSuggestions, setShowPlaceSuggestions] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const autocompleteSessionRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const placeDropdownRef = useRef<HTMLDivElement>(null);

  // relationship / anniversary editor (admin panel)
  const [localRelationshipDate, setLocalRelationshipDate] = useState<string>(relationshipStartDate ? relationshipStartDate.toISOString().split('T')[0] : '');
  const [isSavingRelationshipDate, setIsSavingRelationshipDate] = useState(false);
  const [relationshipSaveMsg, setRelationshipSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    setLocalRelationshipDate(relationshipStartDate ? relationshipStartDate.toISOString().split('T')[0] : '');
  }, [relationshipStartDate]);

  const handleSave = async () => {
    // Persist localPhotos to Supabase (upsert).
    // For storage-backed photos we MUST persist `storage_path` (the canonical pointer) instead of the ephemeral signed URL.
    try {
      // Upsert only the canonical DB columns — do NOT persist ephemeral `src` values.
      const toUpsert = localPhotos.map(({ id, title, date, location, description, favorite, storage_path, lat, lng }) => (
        { id, title, date, location, description, favorite, storage_path, lat, lng }
      ));

      const { data, error } = await supabase.from('photos').upsert(toUpsert).select();
      if (error) {
        console.error('Failed to upsert photos:', error);
        // still update UI locally
        onUpdatePhotos(localPhotos);
      } else if (data) {
        // resolve signed URLs for any rows that have a storage_path so UI keeps showing a valid runtime URL
        const resolved = await Promise.all((data as any[]).map(async (r) => {
          if (r.storage_path) {
            try {
              const { data: signed, error: signedErr } = await supabase.storage.from('photos').createSignedUrl(r.storage_path, 60 * 60);
              if (!signedErr && signed?.signedUrl) return { ...r, src: signed.signedUrl };
            } catch (err) { console.warn('createSignedUrl error', err); }
            return { ...r, src: r.src };
          }
          return r;
        }));

        setLocalPhotos(resolved as Photo[]);
        onUpdatePhotos(resolved as Photo[]);
      }
    } catch (err) {
      console.error(err);
      onUpdatePhotos(localPhotos);
    } finally {
      onClose();
    }
  };

  const handleDelete = async (id: number) => {
    // delete from DB and delete object from storage when present
    try {
      const photo = localPhotos.find(p => p.id === id);
      if (photo?.storage_path) {
        try {
          const { error: delErr } = await supabase.storage.from('photos').remove([photo.storage_path]);
          if (delErr) console.warn('storage remove error', delErr);
        } catch (err) {
          console.warn('storage remove exception', err);
        }
      }

      const { error } = await supabase.from('photos').delete().eq('id', id);
      if (error) console.error('delete error', error);
      setLocalPhotos(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      console.error(err);
      setLocalPhotos(prev => prev.filter(p => p.id !== id));
    }
  };

  const handleEdit = (photo: Photo) => {
    setEditingPhoto({ ...photo });
    setUploadedImage(photo.src);
  };

  const handleSaveEdit = async () => {
    if (!editingPhoto) return;

    // try uploading file to storage first (if provided)
    let finalSrc = editingPhoto.src;
    if (uploadedFile) {
      try {
        const filePath = `${Date.now()}_${uploadedFile.name}`;
        const { error: uploadErr } = await supabase.storage.from('photos').upload(filePath, uploadedFile, { upsert: true });
        if (!uploadErr) {
          // persist canonical storage_path (DO NOT store the ephemeral signed URL in DB)
          editingPhoto.storage_path = filePath;
          const { data: signedUrlData, error: signedErr } = await supabase.storage.from('photos').createSignedUrl(filePath, 60 * 60);
          if (!signedErr && signedUrlData?.signedUrl) finalSrc = signedUrlData.signedUrl;
          setUploadError(null);
        } else {
          console.warn('storage upload failed', uploadErr);
          setUploadError('Storage upload failed (permission denied). File will be saved as a data-URL until uploads are enabled for admins.');
        }
      } catch (err) {
        console.warn('storage upload exception', err);
        setUploadError('Storage upload failed (exception). File will be saved as a data-URL until uploads are enabled for admins.');
      }
    } else {
      // If no new upload but `src` contains a Supabase signed URL, extract storage_path so we persist the pointer instead of the ephemeral URL
      if (!editingPhoto.storage_path && typeof editingPhoto.src === 'string') {
        const extracted = extractStoragePathFromSignedUrl(editingPhoto.src);
        if (extracted) editingPhoto.storage_path = extracted;
      }
    }

    // Prepare DB row — persist canonical columns only (do NOT write `src` to DB).
    const toUpsert = {
      id: editingPhoto.id,
      title: editingPhoto.title,
      date: editingPhoto.date,
      location: editingPhoto.location,
      description: editingPhoto.description,
      favorite: editingPhoto.favorite,
      storage_path: editingPhoto.storage_path,
      lat: editingPhoto.lat,
      lng: editingPhoto.lng,
    };

    try {
      const { data, error } = await supabase.from('photos').upsert(toUpsert).select();
      if (error) {
        console.error('save edit error', error);
        setLocalPhotos(prev => prev.map(p => p.id === editingPhoto.id ? editingPhoto : p));
      } else {
        const updated = Array.isArray(data) ? data[0] : data;
        // keep runtime `src` as the signed URL we generated (finalSrc) when storage_path is present
        const display = (editingPhoto.storage_path ? { ...(updated as Photo), src: finalSrc } : (updated as Photo));
        setLocalPhotos(prev => prev.map(p => p.id === (display as any).id ? display as Photo : p));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUploadedFile(null);
      setEditingPhoto(null);
      setUploadedImage(null);
    }
  };

  const handleAdd = () => {
    const newPhoto: Photo = {
      id: Date.now(),
      src: '',
      title: 'New Photo',
      date: new Date().toISOString().split('T')[0],
      location: '',
      description: '',
      favorite: false,
    };
    setEditingPhoto(newPhoto);
    setUploadedImage(null);
    setIsAdding(true);
  };

  const handleSaveNew = async () => {
    if (!editingPhoto || !uploadedImage) return;

    // attempt to upload file to storage if available
    let finalSrc = uploadedImage;
    if (uploadedFile) {
      try {
        const filePath = `${Date.now()}_${uploadedFile.name}`;
        const { error: uploadErr } = await supabase.storage.from('photos').upload(filePath, uploadedFile, { upsert: true });
        if (!uploadErr) {
          // persist canonical storage_path (don't store the ephemeral signed URL in DB)
          editingPhoto.storage_path = filePath;
          const { data: signedUrlData, error: signedErr } = await supabase.storage.from('photos').createSignedUrl(filePath, 60 * 60);
          if (!signedErr && signedUrlData?.signedUrl) finalSrc = signedUrlData.signedUrl;
          else console.warn('createSignedUrl failed', signedErr);
        } else {
          console.warn('storage upload failed', uploadErr);
        }
      } catch (err) {
        console.warn('storage upload error', err);
      }
    }

    // Persist canonical columns into DB (do NOT write `src`). Use `finalSrc` for immediate UI display.
    const photoToInsert = {
      id: editingPhoto.id,
      title: editingPhoto.title,
      date: editingPhoto.date,
      location: editingPhoto.location,
      description: editingPhoto.description,
      favorite: editingPhoto.favorite,
      storage_path: editingPhoto.storage_path,
      lat: editingPhoto.lat,
      lng: editingPhoto.lng,
    };
    try {
      const { data, error } = await supabase.from('photos').insert(photoToInsert).select();
      if (error) {
        console.error('insert error', error);
        setLocalPhotos(prev => [...prev, photoToInsert]);
        onUpdatePhotos([...localPhotos, photoToInsert]);
      } else {
        const inserted = Array.isArray(data) ? data[0] : data;
        // show the signed URL in UI immediately when storage_path was used
        const displayInserted = editingPhoto.storage_path ? { ...(inserted as Photo), src: finalSrc } : (inserted as Photo);
        setLocalPhotos(prev => [...prev, displayInserted as Photo]);
        onUpdatePhotos([...localPhotos, displayInserted as Photo]);
      }
    } catch (err) {
      console.error(err);
      setLocalPhotos(prev => [...prev, photoToInsert]);
      onUpdatePhotos([...localPhotos, photoToInsert]);
    } finally {
      setUploadedFile(null);
      setEditingPhoto(null);
      setUploadedImage(null);
      setIsAdding(false);
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    const newPhotos = [...localPhotos];
    const draggedPhoto = newPhotos[draggedIndex];
    newPhotos.splice(draggedIndex, 1);
    newPhotos.splice(index, 0, draggedPhoto);
    setLocalPhotos(newPhotos);
    setDraggedIndex(index);
  };

  const toggleFavorite = async (id: number) => {
    setLocalPhotos(prev => prev.map(p => p.id === id ? { ...p, favorite: !p.favorite } : p));
    const photo = localPhotos.find(p => p.id === id);
    try {
      if (photo) {
        const { error } = await supabase.from('photos').update({ favorite: !photo.favorite }).eq('id', id);
        if (error) console.error('toggleFavorite error', error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setUploadError(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setUploadedImage(result);
        if (editingPhoto) {
          setEditingPhoto({ ...editingPhoto, src: result });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Google Places Autocomplete — new API (AutocompleteSuggestion + Place)
  const handlePlaceSearch = async (query: string) => {
    setPlaceQuery(query);
    setGeocodeError(null);
    if (query.length < 3) { setPlaceSuggestions([]); setShowPlaceSuggestions(false); return; }

    const gPlaces = (window as any).google?.maps?.places;
    if (!gPlaces) { setGeocodeError('Google Places not loaded'); return; }

    // lazily create session token
    if (!autocompleteSessionRef.current) {
      autocompleteSessionRef.current = new google.maps.places.AutocompleteSessionToken();
    }

    try {
      // New API: google.maps.places.AutocompleteSuggestion
      const { suggestions } = await (gPlaces.AutocompleteSuggestion as any).fetchAutocompleteSuggestions({
        input: query,
        sessionToken: autocompleteSessionRef.current,
      });

      const mapped = (suggestions || []).map((s: any) => ({
        placeId: s.placePrediction.placeId as string,
        description: s.placePrediction.text.text as string,
        toPlace: () => s.placePrediction.toPlace(),
      }));

      setPlaceSuggestions(mapped);
      setShowPlaceSuggestions(mapped.length > 0);
    } catch (err) {
      console.warn('Autocomplete fetch error', err);
      setPlaceSuggestions([]);
    }
  };

  // When user picks a suggestion — use Place.fetchFields for lat/lng (Essentials)
  const handlePlaceSelect = async (suggestion: { placeId: string; description: string; toPlace: () => any }) => {
    setPlaceQuery(suggestion.description);
    setPlaceSuggestions([]);
    setShowPlaceSuggestions(false);
    setIsGeocoding(true);
    setGeocodeError(null);

    try {
      const place = suggestion.toPlace();
      await place.fetchFields({
        fields: ['location', 'formattedAddress', 'displayName'],
      });

      // expire session token so next search starts a new billing session
      autocompleteSessionRef.current = new google.maps.places.AutocompleteSessionToken();

      const loc = place.location;
      if (loc) {
        const lat = typeof loc.lat === 'function' ? loc.lat() : loc.lat;
        const lng = typeof loc.lng === 'function' ? loc.lng() : loc.lng;
        const locationName = place.formattedAddress || place.displayName || suggestion.description;
        setEditingPhoto(prev => prev ? ({ ...prev, lat, lng, location: locationName }) : null);
        setPlaceQuery(locationName);
      } else {
        setGeocodeError('Place has no location data');
      }
    } catch (err) {
      console.error('Place.fetchFields error', err);
      setGeocodeError('Could not fetch place details');
    } finally {
      setIsGeocoding(false);
    }
  };

  // close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (placeDropdownRef.current && !placeDropdownRef.current.contains(e.target as Node)) {
        setShowPlaceSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ────────────── Milestones CRUD ──────────────
  const [localMilestones, setLocalMilestones] = useState<Milestone[]>(propMilestones);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [isAddingMilestone, setIsAddingMilestone] = useState(false);

  const handleAddMilestone = () => {
    setEditingMilestone({
      id: Date.now(),
      date: new Date().toISOString().slice(0, 10),
      title: '',
      description: '',
      icon: <Heart className="w-5 h-5" />,
      icon_name: 'heart',
    });
    setIsAddingMilestone(true);
  };

  const handleSaveMilestone = async () => {
    if (!editingMilestone) return;
    const baseRow = {
      event_date: editingMilestone.date,
      title: editingMilestone.title,
      description: editingMilestone.description,
      icon_name: editingMilestone.icon_name || 'heart',
    };
    const toMilestone = (row: any): Milestone => ({
      id: row.id,
      date: row.event_date,
      title: row.title,
      description: row.description,
      icon: iconFromName(row.icon_name),
      icon_name: row.icon_name,
    });
    try {
      if (isAddingMilestone) {
        // Don't send id — it's auto-generated
        const { data, error } = await supabase.from('milestones').insert(baseRow).select();
        if (error) { console.error('milestone insert error', error); return; }
        const inserted = Array.isArray(data) ? data[0] : data;
        const ms = toMilestone(inserted);
        const updated = [...localMilestones, ms];
        setLocalMilestones(updated);
        onUpdateMilestones(updated);
      } else {
        const row = { ...baseRow, id: editingMilestone.id };
        const { data, error } = await supabase.from('milestones').upsert(row).select();
        if (error) { console.error('milestone upsert error', error); return; }
        const saved = Array.isArray(data) ? data[0] : data;
        const ms = toMilestone(saved);
        const updated = localMilestones.map(m => m.id === ms.id ? ms : m);
        setLocalMilestones(updated);
        onUpdateMilestones(updated);
      }
    } catch (err) {
      console.error('milestone save error', err);
    } finally {
      setEditingMilestone(null);
      setIsAddingMilestone(false);
    }
  };

  const handleDeleteMilestone = async (id: number) => {
    try {
      const { error } = await supabase.from('milestones').delete().eq('id', id);
      if (error) console.error('milestone delete error', error);
      const updated = localMilestones.filter(m => m.id !== id);
      setLocalMilestones(updated);
      onUpdateMilestones(updated);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-rose-100 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gradient">Admin Panel</h2>
            <p className="text-rose-600/70 text-sm">Manage our precious memories</p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={handleAdd} className="bg-rose-500 hover:bg-rose-600">
              <Plus className="w-4 h-4 mr-2" />
              Add Photo
            </Button>
            <Button variant="ghost" onClick={onClose} className="text-rose-500 hover:bg-rose-50">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 p-6">
          <div className="space-y-3">
            {/* Relationship / anniversary editor */}
            <div className="p-4 bg-white/60 rounded-xl border border-rose-100">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="font-medium text-rose-800">Relationship start date</h4>
                  <p className="text-xs text-rose-500">Used for "Since ..." label and the "Together for" counter.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={localRelationshipDate}
                    onChange={(e) => setLocalRelationshipDate(e.target.value)}
                    className="text-sm"
                  />
                  <Button
                    onClick={async () => {
                      setIsSavingRelationshipDate(true);
                      setRelationshipSaveMsg(null);
                      try {
                        // prefer new `anniversaries` table; fall back to `site_settings` if table missing
                        const { error: upsertErr } = await supabase.from('anniversaries').upsert({ id: 1, start_date: localRelationshipDate });
                        if (upsertErr) {
                          // fallback: save into site_settings (legacy)
                          console.warn('anniversaries.upsert failed, falling back to site_settings', upsertErr.message || upsertErr);
                          const { error: ssErr } = await supabase.from('site_settings').upsert({ key: 'relationship_start_date', value: { date: localRelationshipDate } }, { onConflict: 'key' });
                          if (ssErr) throw ssErr;
                        }

                        // notify parent to refresh UI immediately
                        if (onUpdateRelationshipStartDate) onUpdateRelationshipStartDate(new Date(localRelationshipDate));
                        setRelationshipSaveMsg('Saved');
                      } catch (err) {
                        console.error('failed to save relationship start date', err);
                        setRelationshipSaveMsg('Failed to save');
                      } finally {
                        setIsSavingRelationshipDate(false);
                        setTimeout(() => setRelationshipSaveMsg(null), 2500);
                      }
                    }}
                    disabled={!localRelationshipDate || isSavingRelationshipDate}
                    className="whitespace-nowrap"
                  >
                    {isSavingRelationshipDate ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </div>
              {relationshipSaveMsg && <div className="text-sm text-rose-600 mt-2">{relationshipSaveMsg}</div>}
            </div>

            {/* ─── Milestones management ─── */}
            <div className="p-4 bg-white/60 rounded-xl border border-rose-100">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-medium text-rose-800">Milestones</h4>
                  <p className="text-xs text-rose-500">Manage the "Our Story" timeline entries.</p>
                </div>
                <Button onClick={handleAddMilestone} size="sm" className="bg-rose-500 hover:bg-rose-600">
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </div>

              {localMilestones.length === 0 && (
                <p className="text-sm text-rose-400 py-4 text-center">No milestones yet.</p>
              )}

              <div className="space-y-2">
                {localMilestones.map(ms => (
                  <div key={ms.id} className="flex items-center gap-3 p-3 bg-rose-50/50 rounded-lg border border-rose-100">
                    <div className="w-8 h-8 bg-gradient-to-br from-rose-400 to-pink-500 rounded-full flex items-center justify-center text-white flex-shrink-0">
                      {ms.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h5 className="font-medium text-rose-800 text-sm truncate">{ms.title || '(untitled)'}</h5>
                      <p className="text-xs text-rose-500 truncate">{ms.date ? new Date(ms.date + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => { setEditingMilestone({ ...ms }); setIsAddingMilestone(false); }}
                        className="p-1.5 bg-rose-100 text-rose-600 rounded-lg hover:bg-rose-200"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteMilestone(ms.id)}
                        className="p-1.5 bg-red-100 text-red-500 rounded-lg hover:bg-red-200"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ─── Photos list ─── */}
            {localPhotos.map((photo, index) => (
              <div
                key={photo.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                className="flex items-center gap-4 p-4 bg-rose-50/50 rounded-xl border border-rose-100 cursor-move hover:bg-rose-50 transition-colors"
              >
                <GripVertical className="w-5 h-5 text-rose-300 flex-shrink-0" />
                <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-rose-100">
                  <img 
                    src={photo.src} 
                    alt={photo.title} 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="%23f43f5e"><rect width="64" height="64"/></svg>';
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-rose-800 truncate">{photo.title}</h4>
                  <p className="text-sm text-rose-600/70">{photo.location}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => toggleFavorite(photo.id)}
                    className={`p-2 rounded-lg transition-colors ${photo.favorite ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-400'}`}
                  >
                    <Star className="w-4 h-4" fill={photo.favorite ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    onClick={() => handleEdit(photo)}
                    className="p-2 bg-rose-100 text-rose-600 rounded-lg hover:bg-rose-200"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(photo.id)}
                    className="p-2 bg-red-100 text-red-500 rounded-lg hover:bg-red-200"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="p-6 border-t border-rose-100 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} className="border-rose-200 text-rose-600">
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-gradient-to-r from-rose-500 to-pink-500 text-white">
            <Check className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingPhoto} onOpenChange={() => { setEditingPhoto(null); setIsAdding(false); setUploadedImage(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogTitle>{isAdding ? 'Add New Photo' : 'Edit Photo'}</DialogTitle>
          {editingPhoto && (
            <div className="space-y-4 mt-4">
              {/* Image Upload */}
              <div>
                <Label>Photo</Label>
                <div className="mt-2">
                  {uploadedImage || editingPhoto.src ? (
                    <div className="relative w-full h-48 rounded-xl overflow-hidden">
                      <img 
                        src={uploadedImage || editingPhoto.src} 
                        alt="Preview" 
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => {
                          setUploadedImage(null);
                          setEditingPhoto({ ...editingPhoto, src: '' });
                        }}
                        className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-48 border-2 border-dashed border-rose-300 rounded-xl flex flex-col items-center justify-center gap-3 hover:bg-rose-50 transition-colors"
                    >
                      <Upload className="w-10 h-10 text-rose-400" />
                      <span className="text-rose-600">Click to upload a photo</span>
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  {uploadError && (
                    <div className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-100 p-2 rounded-md">
                      {uploadError} <strong className="block mt-1">To enable uploads to the private `photos` bucket: sign-in as an authenticated admin or allow storage writes for admins in Supabase.</strong>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label>Title</Label>
                <Input 
                  value={editingPhoto.title} 
                  onChange={(e) => setEditingPhoto({ ...editingPhoto, title: e.target.value })}
                />
              </div>
              <div>
                <Label>Date</Label>
                <Input 
                  type="date"
                  value={editingPhoto.date} 
                  onChange={(e) => setEditingPhoto({ ...editingPhoto, date: e.target.value })}
                />
              </div>
              <div>
                <Label>Location</Label>
                <div ref={placeDropdownRef} className="relative mt-1">
                  <Input
                    value={placeQuery}
                    onChange={(e) => handlePlaceSearch(e.target.value)}
                    onFocus={() => { if (placeSuggestions.length) setShowPlaceSuggestions(true); }}
                    placeholder="Search for a place…"
                    className="pr-8"
                  />
                  {isGeocoding && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}

                  {showPlaceSuggestions && placeSuggestions.length > 0 && (
                    <ul className="absolute z-50 left-0 right-0 mt-1 bg-white border border-rose-200 rounded-xl shadow-lg max-h-56 overflow-auto">
                      {placeSuggestions.map(p => (
                        <li
                          key={p.placeId}
                          onClick={() => handlePlaceSelect(p)}
                          className="px-3 py-2.5 text-sm cursor-pointer hover:bg-rose-50 flex items-start gap-2 transition-colors"
                        >
                          <MapPin className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
                          <span className="text-rose-800">{p.description}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <p className="text-xs text-rose-500 mt-1">
                  Powered by Google Places (Essentials). Selecting a suggestion auto-fills lat/lng.
                </p>

                {geocodeError && <div className="text-sm text-amber-700 mt-2">{geocodeError}</div>}
                {editingPhoto.lat != null && editingPhoto.lng != null && (
                  <div className="text-sm text-rose-600 mt-2">📍 {editingPhoto.lat.toFixed(5)}, {editingPhoto.lng.toFixed(5)}</div>
                )}
              </div>

              <div>
                <Label>Description</Label>
                <Input 
                  value={editingPhoto.description} 
                  onChange={(e) => setEditingPhoto({ ...editingPhoto, description: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch 
                  checked={editingPhoto.favorite} 
                  onCheckedChange={(checked) => setEditingPhoto({ ...editingPhoto, favorite: checked })}
                />
                <Label>Mark as Favorite</Label>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => { setEditingPhoto(null); setIsAdding(false); setUploadedImage(null); }}>
                  Cancel
                </Button>
                <Button 
                  onClick={isAdding ? handleSaveNew : handleSaveEdit}
                  disabled={isAdding && !uploadedImage}
                  className="bg-rose-500 hover:bg-rose-600"
                >
                  {isAdding ? 'Add Photo' : 'Save Changes'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Milestone Edit Dialog */}
      <Dialog open={!!editingMilestone} onOpenChange={() => { setEditingMilestone(null); setIsAddingMilestone(false); }}>
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogTitle>{isAddingMilestone ? 'Add Milestone' : 'Edit Milestone'}</DialogTitle>
          {editingMilestone && (
            <div className="space-y-4 mt-4">
              <div>
                <Label>Title</Label>
                <Input
                  value={editingMilestone.title}
                  onChange={(e) => setEditingMilestone({ ...editingMilestone, title: e.target.value })}
                  placeholder="e.g., The Day We Met"
                />
              </div>
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={editingMilestone.date}
                  onChange={(e) => setEditingMilestone({ ...editingMilestone, date: e.target.value })}
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={editingMilestone.description}
                  onChange={(e) => setEditingMilestone({ ...editingMilestone, description: e.target.value })}
                  placeholder="What made this moment special?"
                  rows={3}
                />
              </div>
              <div>
                <Label>Icon</Label>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {MILESTONE_ICON_NAMES.map(name => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setEditingMilestone({ ...editingMilestone, icon_name: name, icon: iconFromName(name) })}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center border-2 transition-all ${
                        editingMilestone.icon_name === name
                          ? 'border-rose-500 bg-rose-50 text-rose-600 scale-110'
                          : 'border-rose-200 text-rose-400 hover:border-rose-300'
                      }`}
                    >
                      {MILESTONE_ICONS[name]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <Button variant="outline" onClick={() => { setEditingMilestone(null); setIsAddingMilestone(false); }}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveMilestone}
                  disabled={!editingMilestone.title}
                  className="bg-rose-500 hover:bg-rose-600"
                >
                  {isAddingMilestone ? 'Add Milestone' : 'Save Changes'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Smart Carousel — no duplication when all photos fit; cyclical wrap-around when they don't
function InfiniteCarousel({ 
  photos, 
  onPhotoClick 
}: { 
  photos: Photo[]; 
  onPhotoClick: (photo: Photo) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  // card metrics
  const CARD_W = 288; // w-72 = 18rem = 288px
  const GAP = 24;     // gap-6 = 1.5rem = 24px

  // Determine whether photos overflow the viewport (needs scrolling / pagination)
  const needsScroll = useMemo(() => {
    // rough check: total cards width vs typical viewport
    const totalW = photos.length * CARD_W + (photos.length - 1) * GAP;
    return totalW > (typeof window !== 'undefined' ? window.innerWidth : 1200);
  }, [photos.length]);

  // display list: only duplicate when scrolling is needed
  const displayPhotos = useMemo(() => {
    if (!needsScroll) return photos;
    // duplicate once for wrap-around (original + copy)
    return [...photos, ...photos];
  }, [photos, needsScroll]);

  const checkArrows = () => {
    if (!containerRef.current || !needsScroll) {
      setShowLeftArrow(false);
      setShowRightArrow(false);
      return;
    }
    const { scrollLeft, scrollWidth, clientWidth } = containerRef.current;
    setShowLeftArrow(scrollLeft > 50);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 50);
  };

  // On mount: if scrollable, start at the beginning (not middle)
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollLeft = 0;
      checkArrows();
    }
  }, [needsScroll]);

  // Cyclical wrap-around: when the user scrolls past the first copy, snap back to start
  useEffect(() => {
    if (!needsScroll) return;
    const el = containerRef.current;
    if (!el) return;

    const handleScroll = () => {
      checkArrows();
      if (!needsScroll) return;
      const singleSetWidth = photos.length * (CARD_W + GAP);

      // scrolled past the end of original set → snap to equivalent position at start
      if (el.scrollLeft >= singleSetWidth) {
        el.scrollLeft -= singleSetWidth;
      } else if (el.scrollLeft <= 0) {
        el.scrollLeft += singleSetWidth;
      }
    };

    el.addEventListener('scrollend', handleScroll);
    return () => el.removeEventListener('scrollend', handleScroll);
  }, [needsScroll, photos.length]);

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - containerRef.current.offsetLeft);
    setScrollLeftState(containerRef.current.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    containerRef.current.scrollLeft = scrollLeftState - walk;
  };

  const handleMouseUp = () => setIsDragging(false);
  const handleMouseLeave = () => setIsDragging(false);

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!containerRef.current) return;
    setStartX(e.touches[0].pageX - containerRef.current.offsetLeft);
    setScrollLeftState(containerRef.current.scrollLeft);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!containerRef.current) return;
    const x = e.touches[0].pageX - containerRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    containerRef.current.scrollLeft = scrollLeftState - walk;
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!containerRef.current || !needsScroll) return;
      if (e.key === 'ArrowLeft') {
        containerRef.current.scrollBy({ left: -(CARD_W + GAP), behavior: 'smooth' });
      } else if (e.key === 'ArrowRight') {
        containerRef.current.scrollBy({ left: CARD_W + GAP, behavior: 'smooth' });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [needsScroll]);

  const scroll = (direction: 'left' | 'right') => {
    if (containerRef.current) {
      containerRef.current.scrollBy({ 
        left: direction === 'left' ? -(CARD_W + GAP) : (CARD_W + GAP), 
        behavior: 'smooth' 
      });
    }
  };

  if (photos.length === 0) {
    return (
      <div className="w-full h-72 rounded-3xl bg-rose-50 flex items-center justify-center text-rose-500/80">
        No photos to show yet — upload one from the Admin Panel.
      </div>
    );
  }

  return (
    <div className="relative w-full">
      {/* Left blur edge */}
      {needsScroll && <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-rose-50 to-transparent z-10 pointer-events-none" />}
      
      {/* Right blur edge */}
      {needsScroll && <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-rose-50 to-transparent z-10 pointer-events-none" />}

      {/* Navigation Arrows — only when scrollable */}
      {needsScroll && showLeftArrow && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-all hover:scale-110"
        >
          <ChevronLeft className="w-6 h-6 text-rose-600" />
        </button>
      )}
      {needsScroll && showRightArrow && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-all hover:scale-110"
        >
          <ChevronRight className="w-6 h-6 text-rose-600" />
        </button>
      )}

      {/* Carousel Container */}
      <div
        ref={containerRef}
        className={`flex gap-6 overflow-x-auto scrollbar-hide py-8 px-12 ${
          needsScroll ? 'cursor-grab active:cursor-grabbing' : 'justify-center'
        }`}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        onMouseDown={needsScroll ? handleMouseDown : undefined}
        onMouseMove={needsScroll ? handleMouseMove : undefined}
        onMouseUp={needsScroll ? handleMouseUp : undefined}
        onMouseLeave={needsScroll ? handleMouseLeave : undefined}
        onTouchStart={needsScroll ? handleTouchStart : undefined}
        onTouchMove={needsScroll ? handleTouchMove : undefined}
        onScroll={needsScroll ? checkArrows : undefined}
      >
        {displayPhotos.map((photo, index) => (
          <div
            key={`${photo.id}-${index}`}
            onClick={() => !isDragging && onPhotoClick(photo)}
            className="flex-shrink-0 w-72 h-96 rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 cursor-pointer group relative"
          >
            <img
              src={photo.src}
              alt={photo.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              draggable={false}
            />
            
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-rose-300" />
                  <span className="text-sm">{new Date(photo.date).toLocaleDateString()}</span>
                </div>
                <h3 className="text-xl font-bold mb-1">{photo.title}</h3>
                <div className="flex items-center gap-2 text-white/80">
                  <MapPin className="w-4 h-4" />
                  <span className="text-sm">{photo.location}</span>
                </div>
              </div>
            </div>

            {/* Favorite Badge */}
            {photo.favorite && (
              <div className="absolute top-3 right-3 bg-rose-500 rounded-full p-2 shadow-lg">
                <Star className="w-4 h-4 text-white fill-current" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Drag hint — only when scrollable */}
      {needsScroll && (
        <p className="text-center text-rose-400 text-sm mt-2 flex items-center justify-center gap-2">
          <span>←</span> Drag or use arrow keys to explore <span>→</span>
        </p>
      )}
    </div>
  );
}

// Time Together Component
function TimeTogether({ startDate }: { startDate: Date }) {
  const [time, setTime] = useState(calculateTimeTogether(startDate));

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(calculateTimeTogether(startDate));
    }, 1000);
    return () => clearInterval(interval);
  }, [startDate]);

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 text-rose-600/80 mt-4">
      <Clock className="w-4 h-4" />
      <span>Together for:</span>
      <div className="flex gap-2 font-mono text-sm">
        {time.years > 0 && <span className="bg-rose-100 px-2 py-1 rounded-lg">{time.years}y</span>}
        <span className="bg-rose-100 px-2 py-1 rounded-lg">{time.totalDays}d</span>
        <span className="bg-rose-100 px-2 py-1 rounded-lg">{time.hours}h</span>
        <span className="bg-rose-100 px-2 py-1 rounded-lg">{time.minutes}m</span>
        <span className="bg-rose-100 px-2 py-1 rounded-lg">{time.seconds}s</span>
      </div>
    </div>
  );
}

// Google Maps Component
function PhotoMap({ photos, onPhotoClick }: { photos: Photo[]; onPhotoClick: (photo: Photo) => void }) {
  // NOTE: we only render PhotoMap when a valid API key exists (App handles fallback).
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '') as string,
    libraries: mapLibraries as any,  // stable ref via top-level const
  });

  const [selectedLocation, setSelectedLocation] = useState<Photo[] | null>(null);

  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Record<string, google.maps.Marker | any>>({});

  const locationGroups = useMemo(() => {
    const groups: Record<string, Photo[]> = {};
    photos.forEach(photo => {
      if (photo.lat && photo.lng) {
        const key = `${photo.lat},${photo.lng}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(photo);
      }
    });
    return groups;
  }, [photos]);

  const center = useMemo(() => {
    const photosWithCoords = photos.filter(p => p.lat && p.lng);
    if (photosWithCoords.length === 0) return { lat: 40.7128, lng: -74.0060 };
    
    const avgLat = photosWithCoords.reduce((sum, p) => sum + (p.lat || 0), 0) / photosWithCoords.length;
    const avgLng = photosWithCoords.reduce((sum, p) => sum + (p.lng || 0), 0) / photosWithCoords.length;
    return { lat: avgLat, lng: avgLng };
  }, [photos]);

  if (loadError) {
    return (
      <div className="w-full h-96 bg-rose-50 rounded-3xl flex items-center justify-center text-amber-700/90 p-4">
        <div>
          <div className="font-medium mb-1">Map failed to load</div>
          <div className="text-sm">Google Maps API error — check your API key and project restrictions.</div>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-96 bg-rose-50 rounded-3xl flex items-center justify-center">
        <Heart className="w-8 h-8 text-rose-400 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="relative w-full h-96 rounded-3xl overflow-hidden shadow-xl">
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={center}
        zoom={4}
        onLoad={(map) => { mapRef.current = map; }}
        onUnmount={() => { mapRef.current = null; Object.values(markersRef.current).forEach((m: any) => { try { m.setMap?.(null); } catch {} }); markersRef.current = {}; }}
        options={{
          mapId: import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID',
          mapTypeId: 'hybrid',
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeControl: false,
        }}
      />

      {/* render markers via Google Maps API (AdvancedMarkerElement when available) */}
      {isLoaded && mapRef.current && Object.entries(locationGroups).map(([key, locationPhotos]) => {
        const existing = markersRef.current[key];
        const pos = { lat: locationPhotos[0].lat!, lng: locationPhotos[0].lng! };

        // create/update marker when missing
        if (!existing) {
          const count = locationPhotos.length;
          const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'>
            <circle cx='24' cy='18' r='16' fill='#f43f5e' stroke='white' stroke-width='3'/>
            <text x='24' y='24' text-anchor='middle' fill='white' font-size='14' font-weight='bold'>${count}</text>
          </svg>`;

          // prefer AdvancedMarkerElement (new), fall back to classic Marker
          if ((window as any).google?.maps?.marker?.AdvancedMarkerElement) {
            const content = document.createElement('div');
            content.innerHTML = svg;
            content.style.cursor = 'pointer';
            // attach click to the DOM content — more reliable than gmp-click
            content.addEventListener('click', (e) => { e.stopPropagation(); setSelectedLocation(locationPhotos); });
            const AdvMarker = (window as any).google.maps.marker.AdvancedMarkerElement;
            const m = new AdvMarker({ position: pos, map: mapRef.current, content });
            markersRef.current[key] = m;
          } else {
            const m = new (window as any).google.maps.Marker({ position: pos, map: mapRef.current, title: `${locationPhotos.length}` });
            m.addListener('click', () => setSelectedLocation(locationPhotos));
            markersRef.current[key] = m;
          }
        } else {
          // update position if changed
          try { existing.setPosition?.(pos); } catch {}
        }

        return null;
      })}

      {/* remove markers when they disappear from the locationGroups */}
      {isLoaded && mapRef.current && (
        (() => {
          const present = new Set(Object.keys(locationGroups));
          Object.keys(markersRef.current).forEach(k => {
            if (!present.has(k)) {
              try { markersRef.current[k].setMap?.(null); } catch {}
              delete markersRef.current[k];
            }
          });
          return null;
        })()
      )}

      {/* Location gallery dialog */}
      <Dialog open={!!selectedLocation} onOpenChange={() => setSelectedLocation(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-white/95 backdrop-blur-xl border-rose-200" aria-describedby={undefined}>
          <DialogTitle className="sr-only">
            Photos at {selectedLocation?.[0]?.location || 'this location'}
          </DialogTitle>
          {selectedLocation && (
            <LocationGallery photos={selectedLocation} onPhotoClick={(photo) => { setSelectedLocation(null); onPhotoClick(photo); }} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Gallery view for a group of photos at one map location
function LocationGallery({ photos, onPhotoClick }: { photos: Photo[]; onPhotoClick: (photo: Photo) => void }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = photos[activeIdx];

  // keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setActiveIdx(i => (i - 1 + photos.length) % photos.length);
      if (e.key === 'ArrowRight') setActiveIdx(i => (i + 1) % photos.length);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [photos.length]);

  return (
    <div className="flex flex-col">
      {/* Main preview */}
      <div className="relative aspect-video bg-black/5 cursor-pointer" onClick={() => onPhotoClick(active)}>
        <img
          src={active.src}
          alt={active.title}
          className="w-full h-full object-cover transition-opacity duration-300"
        />
        {active.favorite && (
          <div className="absolute top-4 right-4 bg-rose-500 rounded-full p-2 shadow-lg">
            <Star className="w-5 h-5 text-white fill-current" />
          </div>
        )}

        {/* Prev / Next arrows (only when > 1 photo) */}
        {photos.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); setActiveIdx(i => (i - 1 + photos.length) % photos.length); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 backdrop-blur rounded-full flex items-center justify-center shadow hover:bg-white transition-all"
            >
              <ChevronLeft className="w-5 h-5 text-rose-600" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setActiveIdx(i => (i + 1) % photos.length); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 backdrop-blur rounded-full flex items-center justify-center shadow hover:bg-white transition-all"
            >
              <ChevronRight className="w-5 h-5 text-rose-600" />
            </button>
          </>
        )}

        {/* Counter badge */}
        {photos.length > 1 && (
          <div className="absolute bottom-3 right-3 bg-black/50 text-white text-xs px-2.5 py-1 rounded-full backdrop-blur">
            {activeIdx + 1} / {photos.length}
          </div>
        )}
      </div>

      {/* Info panel */}
      <div className="p-6">
        <div className="flex items-center gap-3 mb-2 text-rose-500">
          <Calendar className="w-5 h-5" />
          <span className="font-medium">{new Date(active.date).toLocaleDateString()}</span>
        </div>
        <h3 className="text-2xl font-bold text-rose-800 mb-2">{active.title}</h3>
        <div className="flex items-center gap-2 text-rose-600/70 mb-3">
          <MapPin className="w-5 h-5" />
          <span>{active.location}</span>
        </div>
        {active.description && (
          <p className="text-rose-700/80 leading-relaxed">{active.description}</p>
        )}
      </div>

      {/* Thumbnail strip (only when > 1 photo) */}
      {photos.length > 1 && (
        <div className="px-6 pb-5 flex gap-2 overflow-x-auto">
          {photos.map((photo, idx) => (
            <button
              key={photo.id}
              onClick={() => setActiveIdx(idx)}
              className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                idx === activeIdx ? 'border-rose-500 ring-2 ring-rose-300 scale-105' : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              <img src={photo.src} alt={photo.title} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function App() {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  // dynamic milestones (fallback to static `milestones` constant)
  const [remoteMilestones, setRemoteMilestones] = useState<Milestone[]>(milestones);
  const [relationshipStartDate, setRelationshipStartDate] = useState<Date | null>(new Date('2023-01-15'));
  const [isLoadingRemote, setIsLoadingRemote] = useState<boolean>(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  // READ-ONLY: fetch persisted data from Supabase (photos, milestones, site_settings)
  useEffect(() => {
    let mounted = true;
    async function loadFromDb() {
      setIsLoadingRemote(true);
      try {
        const { data: photosData, error: photosError } = await supabase
          .from('photos')
          .select('*')
          .order('id', { ascending: true });
        if (photosError) console.error('supabase.photos.select error', photosError);
        else if (mounted && photosData) {
          // resolve signed URLs for any rows that have a storage_path (private files)
          const resolved = await Promise.all((photosData as any[]).map(async (p) => {
            if (p.storage_path) {
              try {
                const { data: signed, error: signedErr } = await supabase.storage.from('photos').createSignedUrl(p.storage_path, 60 * 60);
                if (!signedErr && signed?.signedUrl) return { ...p, src: signed.signedUrl };
              } catch (err) {
                console.warn('createSignedUrl error', err);
              }
              return { ...p, src: p.src };
            }
            return p;
          }));
          setPhotos(resolved as Photo[]);
        }

        const { data: milestonesData, error: milestonesError } = await supabase
          .from('milestones')
          .select('*')
          .order('event_date', { ascending: false });
        if (!milestonesError && mounted && milestonesData) {
          setRemoteMilestones((milestonesData as any[]).map(m => ({
            id: m.id,
            date: m.event_date,
            title: m.title,
            description: m.description,
            icon: iconFromName(m.icon_name),
            icon_name: m.icon_name,
          })));
        }

        // read legacy `site_settings` first (avoids requesting a table that may not exist in older DBs)
        const { data: settingsData, error: settingsError } = await supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'relationship_start_date')
          .maybeSingle();
        if (!settingsError && mounted && settingsData?.value?.date) {
          setRelationshipStartDate(new Date(settingsData.value.date));
        }
        // No longer querying the `anniversaries` table — all date storage now uses site_settings.
      } catch (err) {
        console.error('loadFromDb error', err);
      } finally {
        if (mounted) setIsLoadingRemote(false);
      }
    }
    loadFromDb();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleAuthSuccess = () => {
    setIsAuthenticated(true);
    setShowAdmin(true);
  };

  const handleUpdatePhotos = (newPhotos: Photo[]) => {
    setPhotos(newPhotos);
  };

  const formatDate = (dateStr: string) => {
    if (dateStr === "Today & Forever") return dateStr;
    return new Date(dateStr).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  if (showAdmin && !isAuthenticated) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-pink-50 to-white">
      {/* Admin Button */}
      <button
        onClick={() => setShowAdmin(true)}
        className="fixed top-4 right-4 z-50 w-12 h-12 bg-white/80 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center hover:bg-white hover:scale-110 transition-all"
      >
        <Settings className="w-5 h-5 text-rose-500" />
      </button>

      {/* Admin Panel */}
      {showAdmin && isAuthenticated && (
        <AdminPanel 
          photos={photos} 
          onUpdatePhotos={handleUpdatePhotos}
          onClose={() => setShowAdmin(false)}
          relationshipStartDate={relationshipStartDate}
          onUpdateRelationshipStartDate={(d: Date) => setRelationshipStartDate(d)}
          milestones={remoteMilestones}
          onUpdateMilestones={setRemoteMilestones}
        />
      )}

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-10 w-72 h-72 bg-rose-200/30 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-pink-200/30 rounded-full blur-3xl animate-pulse delay-1000" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-rose-100/20 rounded-full blur-3xl" />
        </div>

        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <Heart
              key={i}
              className={`absolute text-rose-300/40 animate-bounce`}
              style={{
                left: `${15 + i * 15}%`,
                top: `${20 + (i % 3) * 25}%`,
                animationDelay: `${i * 0.5}s`,
                animationDuration: '3s'
              }}
              size={20 + i * 5}
              fill="currentColor"
            />
          ))}
        </div>

        <div className={`relative z-10 text-center px-6 max-w-4xl mx-auto transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="mb-8">
            <Heart className="w-16 h-16 text-rose-500 mx-auto mb-6 animate-pulse" fill="currentColor" />
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-6 text-gradient leading-tight">
            Our Journey Together
          </h1>
          
          <p className="text-xl md:text-2xl text-rose-700/80 mb-4 font-light italic">
            "Every time I think of us, it’s not the big moments — it’s the quiet lambing in between."
          </p>
          
          <div className="flex items-center justify-center gap-4 mt-8 text-rose-600/70">
            <Calendar className="w-5 h-5" />
            <span className="text-lg">{relationshipStartDate ? `Since ${relationshipStartDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` : 'Since January 15, 2023'}</span>
          </div>

          <TimeTogether startDate={relationshipStartDate ?? new Date('2023-01-15')} />

          <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg"
              className="bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white px-8 py-6 text-lg rounded-full shadow-lg shadow-rose-500/25 transition-all hover:scale-105"
              onClick={() => document.getElementById('gallery')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <Camera className="w-5 h-5 mr-2" />
              View Our Photos
            </Button>
            <Button 
              size="lg"
              variant="outline"
              className="border-rose-400 text-rose-600 hover:bg-rose-50 px-8 py-6 text-lg rounded-full transition-all hover:scale-105"
              onClick={() => document.getElementById('timeline')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <Clock className="w-5 h-5 mr-2" />
              Our Story
            </Button>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-rose-400 rounded-full flex justify-center pt-2">
            <div className="w-1.5 h-3 bg-rose-400 rounded-full animate-pulse" />
          </div>
        </div>
      </section>

      {/* Photo Gallery Section */}
      <section id="gallery" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Heart className="w-10 h-10 text-rose-500 mx-auto mb-4" fill="currentColor" />
            <h2 className="text-4xl md:text-5xl font-bold text-gradient mb-4">
              Our Memories
            </h2>
            <p className="text-lg text-rose-700/70 max-w-2xl mx-auto">
              Every photo tells a story of love, laughter, and the beautiful moments we've shared.
            </p>
          </div>

          {/* Google Maps */}
          <div className="mb-16">
            <h3 className="text-2xl font-bold text-rose-800 mb-6 text-center flex items-center justify-center gap-2">
              <MapPin className="w-6 h-6" />
              Where Our Memories Were Made
            </h3>
            {import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? (
              <PhotoMap photos={photos} onPhotoClick={setSelectedPhoto} />
            ) : (
              <div className="w-full h-96 bg-rose-50 rounded-3xl flex items-center justify-center text-rose-500/80">
                Map disabled — set `VITE_GOOGLE_MAPS_API_KEY` to enable the interactive map.
              </div>
            )}
          </div>

          {/* Infinite Drag Carousel */}
          <div className="mt-16">
            <h3 className="text-2xl font-bold text-rose-800 mb-8 text-center">
              Swipe Through Our Moments
            </h3>
            <InfiniteCarousel photos={photos} onPhotoClick={setSelectedPhoto} />
          </div>
        </div>
      </section>

      {/* Timeline Section */}
      <section id="timeline" className="py-24 px-6 bg-gradient-to-b from-white to-rose-50/50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <Clock className="w-10 h-10 text-rose-500 mx-auto mb-4" />
            <h2 className="text-4xl md:text-5xl font-bold text-gradient mb-4">
              Our Story
            </h2>
            <p className="text-lg text-rose-700/70">
              The beautiful milestones that have shaped our journey together.
            </p>
          </div>

          <div className="relative">
            {/* Only show the vertical timeline line when milestones exist */}
            {remoteMilestones && remoteMilestones.length > 0 && (
              <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-rose-300 via-pink-400 to-rose-300 md:-translate-x-1/2" />
            )}

            {isLoadingRemote && (
              <div className="w-full text-center text-sm text-rose-500 mb-6">Loading milestones…</div>
            )}

            {(!remoteMilestones || remoteMilestones.length === 0) && !isLoadingRemote && (
              <div className="w-full text-center text-rose-500/80 py-12">No milestones yet — add one via the Admin Panel.</div>
            )}

            {(remoteMilestones && remoteMilestones.length > 0) && remoteMilestones.map((milestone, index) => (
              <div
                key={milestone.id}
                className={`relative flex items-start gap-8 mb-12 ${
                  index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
                }`}
              >
                <div className={`flex-1 ml-16 md:ml-0 ${
                  index % 2 === 0 ? 'md:text-right md:pr-12' : 'md:text-left md:pl-12'
                }`}>
                  <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-rose-100 hover:shadow-xl transition-shadow">
                    <span className="text-rose-500 font-medium text-sm mb-2 block">
                      {milestone.date ? new Date(milestone.date + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}
                    </span>
                    <h3 className="text-xl font-bold text-rose-800 mb-3">
                      {milestone.title}
                    </h3>
                    <p className="text-rose-700/70 leading-relaxed">
                      {milestone.description}
                    </p>
                  </div>
                </div>

                <div className="absolute left-6 md:left-1/2 w-12 h-12 bg-gradient-to-br from-rose-400 to-pink-500 rounded-full flex items-center justify-center shadow-lg shadow-rose-500/30 z-10 md:-translate-x-1/2">
                  <div className="text-white">
                    {milestone.icon}
                  </div>
                </div>

                <div className="hidden md:block flex-1" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 px-6 bg-gradient-to-t from-rose-100 to-rose-50">
        <div className="max-w-2xl mx-auto text-center">
          <Heart className="w-12 h-12 text-rose-500 mx-auto mb-6 animate-pulse" fill="currentColor" />
          <h3 className="text-3xl font-bold text-gradient mb-4">
            Forever & Always
          </h3>
          <p className="text-rose-700/70 text-lg mb-8 italic">
            “I don’t need promises of forever. I just need you choosing me, even when it’s hard.”
          </p>
          <div className="flex items-center justify-center gap-2 text-rose-500">
            <span className="text-sm">Made with</span>
            <Heart className="w-4 h-4 fill-current" />
            <span className="text-sm">for you, sweetheart ko; mahal kita</span>
          </div>
        </div>
      </footer>

      {/* Photo Detail Dialog */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-white/95 backdrop-blur-xl border-rose-200" aria-describedby={undefined}>
          <DialogTitle className="sr-only">
            {selectedPhoto?.title || 'Photo Details'}
          </DialogTitle>
          <ScrollArea className="max-h-[85vh]">
            {selectedPhoto && (
              <div className="flex flex-col">
                <div className="relative aspect-video">
                  <img
                    src={selectedPhoto.src}
                    alt={selectedPhoto.title}
                    className="w-full h-full object-cover"
                  />
                  {selectedPhoto.favorite && (
                    <div className="absolute top-4 right-4 bg-rose-500 rounded-full p-2 shadow-lg">
                      <Star className="w-5 h-5 text-white fill-current" />
                    </div>
                  )}
                </div>
                <div className="p-8">
                  <div className="flex items-center gap-3 mb-3 text-rose-500">
                    <Calendar className="w-5 h-5" />
                    <span className="font-medium">{formatDate(selectedPhoto.date)}</span>
                  </div>
                  <h3 className="text-3xl font-bold text-rose-800 mb-3">
                    {selectedPhoto.title}
                  </h3>
                  <div className="flex items-center gap-2 text-rose-600/70 mb-4">
                    <MapPin className="w-5 h-5" />
                    <span>{selectedPhoto.location}</span>
                  </div>
                  <p className="text-rose-700/80 text-lg leading-relaxed">
                    {selectedPhoto.description}
                  </p>
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default App;

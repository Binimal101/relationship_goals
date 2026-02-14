import { useState, useEffect, useRef, useMemo } from 'react';
import { Heart, Calendar, Camera, MapPin, Star, Clock, Lock, Settings, Plus, Trash2, Edit2, GripVertical, X, Check, Upload, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';

// Photo data structure
interface Photo {
  id: number;
  src: string;
  title: string;
  date: string;
  location: string;
  description: string;
  favorite?: boolean;
  lat?: number;
  lng?: number;
}

// Milestone data structure
interface Milestone {
  id: number;
  date: string;
  title: string;
  description: string;
  icon: React.ReactNode;
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
  
  const years = Math.floor(diff / (1000 * 60 * 60 * 24 * 365));
  const days = Math.floor((diff % (1000 * 60 * 60 * 24 * 365)) / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  return { years, days, hours, minutes, seconds };
}

// Google Maps libraries
const mapLibraries: ("places" | "geometry" | "drawing" | "visualization")[] = ["places"];

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

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingQuestions(true);
      try {
        const { data, error } = await supabase
          .from('admin_auth_questions')
          .select('key, label, placeholder, type')
          .order('key', { ascending: true });
        if (error || !data) {
          console.warn('failed to load admin_auth_questions from DB, using fallback', error);
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
    return () => { mounted = false; };
  }, []);

  const handleInputChange = (id: string, value: string, type: string) => {
    let formattedValue = value;
    if (type === 'date') formattedValue = formatDateInput(value);
    setAnswers(prev => ({ ...prev, [id]: formattedValue }));
    setError('');
  };

  const handleSubmit = async () => {
    if (!questions) return;
    setIsChecking(true);

    // verify answers server-side via RPC (no plaintext stored in client)
    try {
      const { data, error } = await supabase.rpc('verify_admin_answers', { answers });
      const ok = data === true || (Array.isArray(data) && data[0] === true);
      if (error) {
        console.error('verify_admin_answers rpc error', error);
        setError('Verification failed — please try again.');
      } else if (ok) {
        onAuthSuccess();
      } else {
        setError("Some answers don't match our memories... Try again! 💕");
      }
    } catch (err) {
      console.error('verification exception', err);
      setError('Verification failed — please try again.');
    } finally {
      setIsChecking(false);
    }
  };

  const isComplete = (questions ?? fallbackAuthQuestions).every(q => answers[q.id]?.trim());

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

          <div className="space-y-5">
            {authQuestions.map((q, index) => (
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
            ))}
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
  onClose 
}: { 
  photos: Photo[]; 
  onUpdatePhotos: (photos: Photo[]) => void;
  onClose: () => void;
}) {
  const [localPhotos, setLocalPhotos] = useState<Photo[]>(photos);
  const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const handleSave = async () => {
    // Persist localPhotos to Supabase (upsert) then close
    try {
      const { data, error } = await supabase.from('photos').upsert(localPhotos).select();
      if (error) {
        console.error('Failed to upsert photos:', error);
        // still update UI locally
        onUpdatePhotos(localPhotos);
      } else if (data) {
        setLocalPhotos(data as Photo[]);
        onUpdatePhotos(data as Photo[]);
      }
    } catch (err) {
      console.error(err);
      onUpdatePhotos(localPhotos);
    } finally {
      onClose();
    }
  };

  const handleDelete = async (id: number) => {
    // delete from DB and update local state
    try {
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

    // if a file was selected, try uploading to storage first
    let finalSrc = editingPhoto.src;
    if (uploadedFile) {
      try {
        const filePath = `${Date.now()}_${uploadedFile.name}`;
        const { error: uploadErr } = await supabase.storage.from('photos').upload(filePath, uploadedFile, { upsert: true });
        if (!uploadErr) {
          const { data: signedUrlData, error: signedErr } = await supabase.storage.from('photos').createSignedUrl(filePath, 60 * 60);
          if (!signedErr && signedUrlData?.signedUrl) {
            finalSrc = signedUrlData.signedUrl;
          } else {
            console.warn('createSignedUrl failed', signedErr);
          }
        } else {
          console.warn('storage upload failed', uploadErr);
        }
      } catch (err) {
        console.warn('storage upload exception', err);
      }
    }

    const toUpsert = { ...editingPhoto, src: finalSrc };

    try {
      const { data, error } = await supabase.from('photos').upsert(toUpsert).select();
      if (error) {
        console.error('save edit error', error);
        setLocalPhotos(prev => prev.map(p => p.id === editingPhoto.id ? editingPhoto : p));
      } else {
        const updated = Array.isArray(data) ? data[0] : data;
        setLocalPhotos(prev => prev.map(p => p.id === (updated as any).id ? (updated as Photo) : p));
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

    const photoToInsert = { ...editingPhoto, src: finalSrc };
    try {
      const { data, error } = await supabase.from('photos').insert(photoToInsert).select();
      if (error) {
        console.error('insert error', error);
        setLocalPhotos(prev => [...prev, photoToInsert]);
        onUpdatePhotos([...localPhotos, photoToInsert]);
      } else {
        const inserted = Array.isArray(data) ? data[0] : data;
        setLocalPhotos(prev => [...prev, inserted as Photo]);
        onUpdatePhotos([...localPhotos, inserted as Photo]);
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

  // Geocode location to get lat/lng
  const geocodeLocation = async () => {
    if (!editingPhoto?.location) return;
    
    setIsGeocoding(true);
    try {
      // Using OpenStreetMap Nominatim API (free, no key needed)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(editingPhoto.location)}`
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        setEditingPhoto(prev => prev ? {
          ...prev,
          lat: parseFloat(lat),
          lng: parseFloat(lon)
        } : null);
      }
    } catch (error) {
      console.error('Geocoding failed:', error);
    }
    setIsGeocoding(false);
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
                <div className="flex gap-2">
                  <Input 
                    value={editingPhoto.location} 
                    onChange={(e) => setEditingPhoto({ ...editingPhoto, location: e.target.value })}
                    placeholder="e.g., Central Park, New York"
                  />
                  <Button
                    type="button"
                    onClick={geocodeLocation}
                    disabled={isGeocoding || !editingPhoto.location}
                    className="bg-rose-500 hover:bg-rose-600 whitespace-nowrap"
                  >
                    {isGeocoding ? '...' : 'Find Coords'}
                  </Button>
                </div>
                <p className="text-xs text-rose-500 mt-1">
                  Enter a location and click "Find Coords" to automatically get latitude/longitude
                </p>
              </div>
              <div>
                <Label>Description</Label>
                <Input 
                  value={editingPhoto.description} 
                  onChange={(e) => setEditingPhoto({ ...editingPhoto, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Latitude</Label>
                  <Input 
                    type="number"
                    step="0.0001"
                    value={editingPhoto.lat || ''} 
                    onChange={(e) => setEditingPhoto({ ...editingPhoto, lat: parseFloat(e.target.value) || undefined })}
                    placeholder="Auto-filled from location"
                  />
                </div>
                <div>
                  <Label>Longitude</Label>
                  <Input 
                    type="number"
                    step="0.0001"
                    value={editingPhoto.lng || ''} 
                    onChange={(e) => setEditingPhoto({ ...editingPhoto, lng: parseFloat(e.target.value) || undefined })}
                    placeholder="Auto-filled from location"
                  />
                </div>
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
    </div>
  );
}

// Infinite Drag Carousel Component (matching the video style)
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
  const [scrollLeft, setScrollLeft] = useState(0);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  // Triple the photos for infinite scroll effect
  const extendedPhotos = useMemo(() => {
    return [...photos, ...photos, ...photos];
  }, [photos]);

  const checkArrows = () => {
    if (containerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = containerRef.current;
      setShowLeftArrow(scrollLeft > 50);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 50);
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      // Start in the middle section
      container.scrollLeft = container.scrollWidth / 3;
      checkArrows();
    }
  }, []);

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - containerRef.current.offsetLeft);
    setScrollLeft(containerRef.current.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    containerRef.current.scrollLeft = scrollLeft - walk;
    checkArrows();
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!containerRef.current) return;
    setStartX(e.touches[0].pageX - containerRef.current.offsetLeft);
    setScrollLeft(containerRef.current.scrollLeft);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!containerRef.current) return;
    const x = e.touches[0].pageX - containerRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    containerRef.current.scrollLeft = scrollLeft - walk;
    checkArrows();
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!containerRef.current) return;
      const cardWidth = 320;
      if (e.key === 'ArrowLeft') {
        containerRef.current.scrollBy({ left: -cardWidth, behavior: 'smooth' });
      } else if (e.key === 'ArrowRight') {
        containerRef.current.scrollBy({ left: cardWidth, behavior: 'smooth' });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (containerRef.current) {
      const cardWidth = 320;
      containerRef.current.scrollBy({ 
        left: direction === 'left' ? -cardWidth : cardWidth, 
        behavior: 'smooth' 
      });
    }
  };

  if (photos.length === 0) return null;

  return (
    <div className="relative w-full">
      {/* Left blur edge */}
      <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-rose-50 to-transparent z-10 pointer-events-none" />
      
      {/* Right blur edge */}
      <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-rose-50 to-transparent z-10 pointer-events-none" />

      {/* Navigation Arrows */}
      {showLeftArrow && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-all hover:scale-110"
        >
          <ChevronLeft className="w-6 h-6 text-rose-600" />
        </button>
      )}
      {showRightArrow && (
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
        className="flex gap-6 overflow-x-auto scrollbar-hide py-8 px-12 cursor-grab active:cursor-grabbing"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onScroll={checkArrows}
      >
        {extendedPhotos.map((photo, index) => (
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

      {/* Drag hint */}
      <p className="text-center text-rose-400 text-sm mt-2 flex items-center justify-center gap-2">
        <span>←</span> Drag or use arrow keys to explore <span>→</span>
      </p>
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
        <span className="bg-rose-100 px-2 py-1 rounded-lg">{time.days}d</span>
        <span className="bg-rose-100 px-2 py-1 rounded-lg">{time.hours}h</span>
        <span className="bg-rose-100 px-2 py-1 rounded-lg">{time.minutes}m</span>
        <span className="bg-rose-100 px-2 py-1 rounded-lg">{time.seconds}s</span>
      </div>
    </div>
  );
}

// Google Maps Component
function PhotoMap({ photos, onPhotoClick }: { photos: Photo[]; onPhotoClick: (photo: Photo) => void }) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: '',
    libraries: mapLibraries,
  });

  const [selectedLocation, setSelectedLocation] = useState<Photo[] | null>(null);

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
        options={{
          styles: [
            {
              featureType: 'all',
              elementType: 'geometry',
              stylers: [{ color: '#fdf2f8' }]
            },
            {
              featureType: 'water',
              elementType: 'geometry',
              stylers: [{ color: '#fce7f3' }]
            }
          ],
          disableDefaultUI: true,
          zoomControl: true,
        }}
      >
        {Object.entries(locationGroups).map(([key, locationPhotos]) => (
          <Marker
            key={key}
            position={{ lat: locationPhotos[0].lat!, lng: locationPhotos[0].lng! }}
            onClick={() => setSelectedLocation(locationPhotos)}
            icon={{
              url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
                `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
                  <circle cx="20" cy="20" r="18" fill="#f43f5e" stroke="white" stroke-width="3"/>
                  <text x="20" y="25" text-anchor="middle" fill="white" font-size="14" font-weight="bold">${locationPhotos.length}</text>
                </svg>`
              ),
              scaledSize: new window.google.maps.Size(40, 40),
            }}
          />
        ))}
      </GoogleMap>

      {selectedLocation && (
        <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-xl rounded-2xl p-4 shadow-xl max-h-64 overflow-auto">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-bold text-rose-800">{selectedLocation[0].location}</h4>
            <button 
              onClick={() => setSelectedLocation(null)}
              className="p-1 hover:bg-rose-100 rounded-full"
            >
              <X className="w-5 h-5 text-rose-500" />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {selectedLocation.map(photo => (
              <div 
                key={photo.id}
                onClick={() => onPhotoClick(photo)}
                className="flex-shrink-0 w-24 cursor-pointer group"
              >
                <img 
                  src={photo.src} 
                  alt={photo.title}
                  className="w-24 h-24 object-cover rounded-xl group-hover:ring-2 ring-rose-500 transition-all"
                />
                <p className="text-xs text-rose-600 mt-1 truncate">{photo.title}</p>
              </div>
            ))}
          </div>
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
        else if (mounted && photosData) setPhotos(photosData as Photo[]);

        const { data: milestonesData, error: milestonesError } = await supabase
          .from('milestones')
          .select('*')
          .order('sort_order', { ascending: true });
        if (!milestonesError && mounted && milestonesData) setRemoteMilestones(milestonesData as Milestone[]);

        const { data: settingsData, error: settingsError } = await supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'relationship_start_date')
          .maybeSingle();
        if (!settingsError && mounted && settingsData?.value?.date) {
          setRelationshipStartDate(new Date(settingsData.value.date));
        }
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
            "Every love story is beautiful, but ours is my favorite."
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
            <PhotoMap photos={photos} onPhotoClick={setSelectedPhoto} />
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
            <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-rose-300 via-pink-400 to-rose-300 md:-translate-x-1/2" />

            {milestones.map((milestone, index) => (
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
                      {milestone.date}
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
            "In all the world, there is no heart for me like yours. In all the world, there is no love for you like mine."
          </p>
          <div className="flex items-center justify-center gap-2 text-rose-500">
            <span className="text-sm">Made with</span>
            <Heart className="w-4 h-4 fill-current" />
            <span className="text-sm">for you</span>
          </div>
        </div>
      </footer>

      {/* Photo Detail Dialog */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-white/95 backdrop-blur-xl border-rose-200">
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

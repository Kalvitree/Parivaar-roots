import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { supabase } from './supabaseClient';

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORY_OPTIONS = [
  'Food & Recipe',
  'Family Tradition',
  'Memory / Story',
  'Language & Expression',
  'Music & Dance',
  'Celebration & Festival',
  'Family History',
];
const BUCKET         = 'attachments';
const MAX_PHOTOS     = 3;
const MAX_PHOTO_MB   = 5;
const MAX_VOICE_SECS = 180; // 3 min

// ─── Helpers ──────────────────────────────────────────────────────────────────
const initials = (name = '') =>
  name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

const timeAgo = (iso) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const fmt = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

const randomToken = () =>
  Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);

const getParam = (key) =>
  new URLSearchParams(window.location.search).get(key) || null;

const AVATAR_PALETTES = [
  { bg: '#FAECE7', fg: '#D85A30' },
  { bg: '#EAF3DE', fg: '#3B6D11' },
  { bg: '#EEEDFE', fg: '#534AB7' },
  { bg: '#FEF9C3', fg: '#92400E' },
  { bg: '#FCE7F3', fg: '#9D174D' },
  { bg: '#E0F2FE', fg: '#0369A1' },
];
const getPalette = (str = '') =>
  AVATAR_PALETTES[(str.charCodeAt(0) || 0) % AVATAR_PALETTES.length];

// ─── Voice Recorder ───────────────────────────────────────────────────────────
function VoiceRecorder({ onBlob }) {
  const [status, setStatus]     = useState('idle'); // idle | recording | done
  const [elapsed, setElapsed]   = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const mrRef     = useRef(null);
  const timerRef  = useRef(null);
  const chunksRef = useRef([]);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mrRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioUrl(URL.createObjectURL(blob));
        setStatus('done');
        onBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      setStatus('recording');
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed((s) => {
          if (s + 1 >= MAX_VOICE_SECS) {
            if (mrRef.current?.state !== 'inactive') mrRef.current.stop();
            clearInterval(timerRef.current);
            return MAX_VOICE_SECS;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      alert('Microphone access is required to record voice memories.');
    }
  };

  const stop = () => {
    if (mrRef.current?.state !== 'inactive') mrRef.current.stop();
    clearInterval(timerRef.current);
  };

  const discard = () => {
    setAudioUrl(null); setElapsed(0); setStatus('idle');
    onBlob(null);
  };

  return (
    <div className="voice-recorder">
      {status === 'idle' && (
        <button className="btn btn-primary btn-full" type="button" onClick={start}>
          🎙 Start recording
        </button>
      )}
      {status === 'recording' && (
        <div className="voice-area">
          <button className="voice-btn" type="button" onClick={stop}
            style={{ background: 'var(--coral)', animation: 'pulse 1s infinite' }}>⏹</button>
          <p className="voice-status">Recording… {fmt(elapsed)} / {fmt(MAX_VOICE_SECS)}</p>
        </div>
      )}
      {status === 'done' && audioUrl && (
        <div>
          <p className="voice-status" style={{ color: 'var(--green)' }}>✅ Recorded ({fmt(elapsed)})</p>
          <audio src={audioUrl} controls style={{ width: '100%', margin: '8px 0' }} />
          <button className="btn btn-full" type="button" style={{ fontSize: 12 }} onClick={discard}>
            Discard &amp; re-record
          </button>
        </div>
      )}
      <p className="help-text" style={{ textAlign: 'center' }}>Max {MAX_VOICE_SECS / 60} minutes</p>
    </div>
  );
}

// ─── Photo Uploader ───────────────────────────────────────────────────────────
function PhotoUploader({ photos, setPhotos }) {
  const inputRef = useRef(null);

  const handleFiles = (e) => {
    const files     = Array.from(e.target.files || []);
    const remaining = MAX_PHOTOS - photos.length;
    const ok = [], bad = [];
    for (const f of files.slice(0, remaining)) {
      if (!f.type.startsWith('image/')) { bad.push(`${f.name}: not an image`); continue; }
      if (f.size > MAX_PHOTO_MB * 1024 * 1024) { bad.push(`${f.name}: over ${MAX_PHOTO_MB} MB`); continue; }
      ok.push({ file: f, url: URL.createObjectURL(f) });
    }
    if (bad.length) alert('Skipped:\n' + bad.join('\n'));
    setPhotos((p) => [...p, ...ok]);
    e.target.value = '';
  };

  const remove = (i) => setPhotos((p) => p.filter((_, idx) => idx !== i));

  return (
    <div>
      <div className="photo-grid">
        {photos.map((p, i) => (
          <div key={i} style={{ position: 'relative' }}>
            <img src={p.url || p.stored_url} alt="" className="photo-thumb" />
            <button type="button" className="photo-remove" onClick={() => remove(i)}>✕</button>
          </div>
        ))}
        {photos.length < MAX_PHOTOS && (
          <button type="button" className="photo-add" onClick={() => inputRef.current?.click()}>+</button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleFiles} style={{ display: 'none' }} />
      <p className="help-text">{photos.length}/{MAX_PHOTOS} photos · max {MAX_PHOTO_MB} MB each</p>
    </div>
  );
}

// ─── Public Shared Memory View (no auth needed) ───────────────────────────────
function SharedMemoryView({ token }) {
  const [mem, setMem]     = useState(null);
  const [loading, setLoad] = useState(true);
  const [expired, setExp]  = useState(false);

  useEffect(() => {
    (async () => {
      const { data: link } = await supabase
        .from('shared_links').select('*, memories(*)').eq('token', token).maybeSingle();
      if (!link) { setExp(true); setLoad(false); return; }
      if (link.expires_at && new Date(link.expires_at) < new Date()) { setExp(true); setLoad(false); return; }
      await supabase.from('shared_links').update({ views: (link.views || 0) + 1 }).eq('token', token);
      setMem(link.memories);
      setLoad(false);
    })();
  }, [token]);

  if (loading) return <div className="app-shell"><div className="spinner" /></div>;

  if (expired || !mem) return (
    <div className="app-shell">
      <div className="screen-content welcome-screen" style={{ textAlign: 'center', paddingTop: 80 }}>
        <div className="hero-logo">🔒</div>
        <h2>This link has expired</h2>
        <p style={{ color: 'var(--text-2)' }}>Ask the family member to share it again.</p>
      </div>
    </div>
  );

  return (
    <div className="app-shell">
      <div className="app-bar">
        <div className="app-logo">🌿</div>
        <div>
          <div className="app-title">Roots</div>
          <div className="app-sub">A family memory, shared with you</div>
        </div>
      </div>
      <div className="screen-content">
        <span className="feed-badge">{mem.category}</span>
        <h2 style={{ fontFamily: 'Lora, serif', margin: '12px 0 4px' }}>{mem.title}</h2>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16 }}>
          {mem.type === 'voice' ? '🎙' : mem.type === 'photo' ? '📷' : mem.type === 'recipe' ? '🍳' : '✍️'} Shared by {mem.author_name}
        </p>

        {mem.voice_url && (
          <div className="audio-card">
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)', margin: '0 0 8px' }}>🎙 Voice memory</p>
            <audio src={mem.voice_url} controls style={{ width: '100%' }} />
          </div>
        )}
        {mem.photo_urls?.length > 0 && (
          <div className="photo-grid" style={{ marginBottom: 16 }}>
            {mem.photo_urls.map((url, i) => (
              <img key={i} src={url} alt="" className="photo-thumb large" />
            ))}
          </div>
        )}
        {mem.content && <p className="detail-content">{mem.content}</p>}

        <div style={{ marginTop: 32, textAlign: 'center', borderTop: '0.5px solid var(--border)', paddingTop: 24 }}>
          <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
            This memory lives in a private family circle on Roots.<br />
            <a href={`${window.location.origin}/parivaar-roots/`} style={{ color: 'var(--green-dark)', fontWeight: 600 }}>
              Preserve your family's story →
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Share Modal ──────────────────────────────────────────────────────────────
function ShareModal({ memory, familyId, onClose, onToast }) {
  const [duration, setDuration]     = useState('7');
  const [generating, setGenerating] = useState(false);
  const [shareUrl, setShareUrl]     = useState(null);
  const [copied, setCopied]         = useState(false);

  const generate = async () => {
    setGenerating(true);
    const token     = randomToken();
    const expiresAt = duration
      ? new Date(Date.now() + Number(duration) * 86400000).toISOString()
      : null;
    const { error } = await supabase.from('shared_links').insert({
      memory_id: memory.id, family_id: familyId, token,
      expires_at: expiresAt, views: 0, created_at: new Date().toISOString(),
    });
    if (error) { onToast('Could not create link: ' + error.message); setGenerating(false); return; }
    setShareUrl(`${window.location.origin}/parivaar-roots/?share=${token}`);
    setGenerating(false);
  };

  const copy = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };

  const share = () => {
    if (navigator.share) navigator.share({ title: memory.title, url: shareUrl });
    else copy();
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-handle" />
        <h3 style={{ fontFamily: 'Lora, serif', margin: '0 0 6px' }}>Share outside the circle</h3>
        <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 20px' }}>
          Creates a view-only link for <strong>"{memory.title}"</strong>. All other family memories stay private.
        </p>

        {!shareUrl ? (
          <>
            <p className="section-label">Link expires after</p>
            <div className="expiry-grid">
              {[{ l: '24 hrs', v: '1' }, { l: '7 days', v: '7' }, { l: '30 days', v: '30' }, { l: 'Never', v: '' }].map(({ l, v }) => (
                <button key={l} type="button"
                  className={`expiry-btn${duration === v ? ' selected' : ''}`}
                  onClick={() => setDuration(v)}>{l}</button>
              ))}
            </div>
            <button className="btn btn-primary btn-full" type="button" onClick={generate} disabled={generating}>
              {generating ? 'Generating…' : '🔗 Create share link'}
            </button>
          </>
        ) : (
          <>
            <div className="share-url-box">
              <p className="section-label" style={{ margin: 0 }}>Your link</p>
              <p style={{ fontSize: 12, wordBreak: 'break-all', margin: '4px 0 0' }}>{shareUrl}</p>
            </div>
            {duration && (
              <p style={{ fontSize: 12, color: '#f59e0b', margin: '0 0 14px' }}>
                ⏱ Expires in {duration === '1' ? '24 hours' : `${duration} days`}
              </p>
            )}
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} type="button" onClick={share}>↗ Share via…</button>
              <button className="btn" style={{ flex: 1 }} type="button" onClick={copy}>
                {copied ? '✓ Copied!' : 'Copy link'}
              </button>
            </div>
            <button className="btn btn-full" type="button" style={{ fontSize: 12 }} onClick={() => setShareUrl(null)}>
              ↺ New link
            </button>
          </>
        )}
        <button className="btn btn-full" type="button" style={{ marginTop: 10, color: 'var(--text-3)' }} onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── PWA Install Banner ───────────────────────────────────────────────────────
function InstallBanner() {
  const [prompt, setPrompt] = useState(null);
  const [show, setShow]     = useState(false);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setPrompt(e); setShow(true); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!show || isStandalone) return null;

  const install = async () => {
    if (!prompt) return;
    prompt.prompt();
    await prompt.userChoice;
    setShow(false);
  };

  return (
    <div className="install-banner-bar" onClick={install}>
      <span style={{ fontSize: 22 }}>🌿</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>Add Roots to your home screen</div>
        <div style={{ fontSize: 12, opacity: 0.8 }}>Opens like an app — no App Store needed</div>
      </div>
      <button type="button"
        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 18, cursor: 'pointer' }}
        onClick={(e) => { e.stopPropagation(); setShow(false); }}>✕</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
function App() {
  // ── URL params (read once on mount) ─────────────────────────────────────────
  const [inviteToken] = useState(() => getParam('invite'));
  const [shareToken]  = useState(() => getParam('share'));

  // ── Auth ─────────────────────────────────────────────────────────────────────
  const [session, setSession] = useState(null);
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail]     = useState('');

  // ── Family ───────────────────────────────────────────────────────────────────
  const [family, setFamily]         = useState(null);
  const [member, setMember]         = useState(null);
  const [members, setMembers]       = useState([]);
  const [setupMode, setSetupMode]   = useState(null);
  const [newFamilyName, setNewFamilyName] = useState('');
  const [setupName, setSetupName]   = useState('');
  const [setupRel, setSetupRel]     = useState('');

  // ── Memories ─────────────────────────────────────────────────────────────────
  const [memories, setMemories]         = useState([]);
  const [filterMember, setFilterMember] = useState(null);
  const [detailId, setDetailId]         = useState(null);

  // ── Add memory form ──────────────────────────────────────────────────────────
  const [memType, setMemType]         = useState('text');
  const [memTitle, setMemTitle]       = useState('');
  const [memContent, setMemContent]   = useState('');
  const [memCategory, setMemCategory] = useState(CATEGORY_OPTIONS[0]);
  const [taggedIds, setTaggedIds]     = useState([]);
  const [voiceBlob, setVoiceBlob]     = useState(null);
  const [photos, setPhotos]           = useState([]);
  const [saving, setSaving]           = useState(false);

  // ── UI ───────────────────────────────────────────────────────────────────────
  const [screen, setScreen]               = useState('welcome');
  const [toast, setToast]                 = useState('');
  const [copyLabel, setCopyLabel]         = useState('Copy invite link');
  const [showShareModal, setShowShareModal] = useState(false);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2600);
  }, []);

  // ── Service worker ───────────────────────────────────────────────────────────
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/parivaar-roots/sw.js').catch(() => {});
    }
  }, []);

  // ── Auth listener ────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Once authenticated, resolve family membership ────────────────────────────
  useEffect(() => {
    if (!user) return;
    resolveFamily();
  }, [user]); // eslint-disable-line

  const resolveFamily = async () => {
    setLoading(true);
    const { data: existing } = await supabase
      .from('members').select('*, family_circles(*)')
      .eq('user_id', user.id).maybeSingle();

    if (existing) {
      setMember(existing);
      setFamily(existing.family_circles);
      await fetchData(existing.family_circles.id);
      setScreen('dashboard');
      setLoading(false);
      return;
    }

    if (inviteToken) {
      const { data: fc } = await supabase
        .from('family_circles').select('*').eq('invite_token', inviteToken).maybeSingle();
      if (fc) {
        setFamily(fc);
        setSetupMode('join');
        setScreen('setup');
        setLoading(false);
        return;
      }
    }

    setScreen('no-access');
    setLoading(false);
  };

  const fetchData = async (familyId) => {
    const fid = familyId || family?.id;
    if (!fid) return;
    const [{ data: mems }, { data: mems2 }] = await Promise.all([
      supabase.from('memories').select('*, memory_tags(member_id)')
        .eq('family_id', fid).order('created_at', { ascending: false }),
      supabase.from('members').select('*')
        .eq('family_id', fid).order('joined_at', { ascending: true }),
    ]);
    setMemories(mems ?? []);
    setMembers(mems2 ?? []);
  };

  // ── Create family circle ──────────────────────────────────────────────────────
  const createFamily = async () => {
    if (!newFamilyName.trim() || !setupName.trim() || !setupRel.trim()) {
      showToast('Fill in all fields.'); return;
    }
    setSaving(true);
    const token = randomToken();
    const { data: fc, error: e1 } = await supabase
      .from('family_circles')
      .insert({ name: newFamilyName.trim(), invite_token: token, created_by: user.id })
      .select().single();
    if (e1) { showToast(e1.message); setSaving(false); return; }

    const { data: m, error: e2 } = await supabase
      .from('members')
      .insert({ family_id: fc.id, user_id: user.id, name: setupName.trim(), relationship: setupRel.trim(), role: 'admin', joined_at: new Date().toISOString() })
      .select().single();
    if (e2) { showToast(e2.message); setSaving(false); return; }

    setFamily(fc); setMember(m);
    await fetchData(fc.id);
    showToast('Circle created! Share your invite link 🎉');
    setScreen('circle');
    setSaving(false);
  };

  // ── Join existing circle ──────────────────────────────────────────────────────
  const joinFamily = async () => {
    if (!setupName.trim() || !setupRel.trim()) { showToast('Enter your name and relationship.'); return; }
    setSaving(true);
    const { count } = await supabase
      .from('members').select('*', { count: 'exact', head: true }).eq('family_id', family.id);
    const { data: m, error } = await supabase
      .from('members')
      .insert({ family_id: family.id, user_id: user.id, name: setupName.trim(), relationship: setupRel.trim(), role: count === 0 ? 'admin' : 'member', joined_at: new Date().toISOString() })
      .select().single();
    if (error) { showToast(error.message); setSaving(false); return; }
    setMember(m);
    await fetchData(family.id);
    showToast(`Welcome to ${family.name}! 🎉`);
    setScreen('dashboard');
    setSaving(false);
  };

  // ── Sign in ───────────────────────────────────────────────────────────────────
  const signIn = async () => {
    if (!email.trim()) { showToast('Enter your email.'); return; }
    const base       = `${window.location.origin}/parivaar-roots/`;
    const redirectTo = inviteToken ? `${base}?invite=${inviteToken}` : base;
    const { error }  = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirectTo } });
    if (error) { showToast(error.message); return; }
    showToast('Magic link sent — check your inbox ✉️');
  };

  // ── Upload helpers ────────────────────────────────────────────────────────────
  const uploadVoice = async (memId) => {
    if (!voiceBlob) return null;
    const path = `voice recording/${family.id}_${memId}.webm`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, voiceBlob, { contentType: 'audio/webm', upsert: true });
    if (error) { showToast('Voice upload failed: ' + error.message); return null; }
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  };

  const uploadPhotos = async (memId) => {
    const urls = [];
    for (let i = 0; i < photos.length; i++) {
      const p = photos[i];
      if (!p.file) { urls.push(p.stored_url); continue; }
      const ext  = p.file.name.split('.').pop();
      const path = `Photos/${family.id}_${memId}_${i}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, p.file, { contentType: p.file.type, upsert: true });
      if (error) { showToast(`Photo ${i + 1} failed: ${error.message}`); continue; }
      urls.push(supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
    }
    return urls;
  };

  // ── Add memory ────────────────────────────────────────────────────────────────
  const addMemory = async () => {
    if (!memTitle.trim()) { showToast('Add a title.'); return; }
    if (['text', 'recipe'].includes(memType) && !memContent.trim()) { showToast('Write your memory.'); return; }
    if (memType === 'voice' && !voiceBlob)  { showToast('Record a voice note first.'); return; }
    if (memType === 'photo' && !photos.length) { showToast('Add at least one photo.'); return; }

    setSaving(true);
    const { data: newMem, error } = await supabase.from('memories').insert({
      family_id: family.id, author_id: user.id, author_name: member.name,
      title: memTitle.trim(), content: memContent.trim(),
      category: memCategory, type: memType, created_at: new Date().toISOString(),
    }).select().single();
    if (error) { showToast(error.message); setSaving(false); return; }

    let voiceUrl = null, photoUrls = [];
    if (memType === 'voice') voiceUrl  = await uploadVoice(newMem.id);
    if (memType === 'photo') photoUrls = await uploadPhotos(newMem.id);

    if (voiceUrl || photoUrls.length) {
      await supabase.from('memories')
        .update({ voice_url: voiceUrl || null, photo_urls: photoUrls.length ? photoUrls : null })
        .eq('id', newMem.id);
    }
    if (taggedIds.length) {
      await supabase.from('memory_tags').insert(
        taggedIds.map((mid) => ({ memory_id: newMem.id, member_id: mid }))
      );
    }

    showToast('Shared with the circle! 🎉');
    setMemTitle(''); setMemContent(''); setTaggedIds([]);
    setMemCategory(CATEGORY_OPTIONS[0]); setMemType('text');
    setVoiceBlob(null); setPhotos([]);
    await fetchData();
    setScreen('dashboard');
    setSaving(false);
  };

  const deleteMemory = async (id) => {
    const m = memories.find((x) => x.id === id);
    if (!m || m.author_id !== user.id) { showToast('You can only delete your own memories.'); return; }
    await supabase.from('memory_tags').delete().eq('memory_id', id);
    await supabase.from('memories').delete().eq('id', id);
    setMemories((list) => list.filter((x) => x.id !== id));
    setScreen('dashboard');
    showToast('Memory deleted.');
  };

  const toggleTag = (id) =>
    setTaggedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const copyInvite = () => {
    if (!family?.invite_token) return;
    const link = `${window.location.origin}/parivaar-roots/?invite=${family.invite_token}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopyLabel('Copied! ✓');
      setTimeout(() => setCopyLabel('Copy invite link'), 2000);
    });
  };

  // ── Derived data ──────────────────────────────────────────────────────────────
  const filteredMemories = useMemo(() => {
    if (!filterMember) return memories;
    return memories.filter((m) =>
      m.memory_tags?.some((t) => t.member_id === filterMember) ||
      m.author_id === members.find((mb) => mb.id === filterMember)?.user_id
    );
  }, [memories, filterMember, members]);

  const activeMemory = useMemo(
    () => memories.find((m) => m.id === detailId),
    [memories, detailId]
  );

  const taggedFor = (mem) =>
    members.filter((mb) => mem.memory_tags?.some((t) => t.member_id === mb.id));

  // ── Public share route — checked AFTER all hooks ──────────────────────────────
  if (shareToken && !loading) return <SharedMemoryView token={shareToken} />;

  // ─── LOADING ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="app-shell">
      <div className="hero-logo" style={{ marginTop: 80 }}>🌿</div>
      <div className="spinner" />
    </div>
  );

  // ─── SIGN-IN ──────────────────────────────────────────────────────────────────
  if (!session) return (
    <div className="app-shell">
      <div className="screen-content welcome-screen">
        <div className="hero">
          <div className="hero-logo">🌿</div>
          <h1>Roots</h1>
          <p>Preserve your family's recipes, stories, and traditions together.</p>
        </div>

        {inviteToken && (
          <div className="invite-banner">
            <div className="invite-banner-icon">🎉</div>
            <div>
              <div className="invite-title">You've been invited!</div>
              <div className="invite-text">Sign in to join your family circle.</div>
            </div>
          </div>
        )}

        <label className="field-label">Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com" onKeyDown={(e) => e.key === 'Enter' && signIn()} />
        <button className="btn btn-primary btn-full" type="button" onClick={signIn}>
          Send magic link →
        </button>
        <p className="help-text">A sign-in link will be sent to your inbox. No password needed.</p>
      </div>
      {toast && <div className="toast show">{toast}</div>}
    </div>
  );

  // ─── NO ACCESS ────────────────────────────────────────────────────────────────
  if (screen === 'no-access') return (
    <div className="app-shell">
      <div className="screen-content welcome-screen" style={{ paddingTop: 40 }}>
        <div className="hero">
          <div className="hero-logo">🌿</div>
          <h1 style={{ fontSize: 26 }}>Welcome to Roots</h1>
          <p>Start a new family circle, or ask a family member for their invite link.</p>
        </div>
        <button className="btn btn-primary btn-full" type="button" style={{ marginBottom: 12 }}
          onClick={() => { setSetupMode('create'); setScreen('setup'); }}>
          🏡 Create a family circle
        </button>
        <button className="btn btn-full" type="button"
          onClick={() => {
            const tok = prompt('Paste your invite link or token:');
            if (!tok) return;
            const match = tok.match(/invite=([a-z0-9]+)/i);
            const t = match ? match[1] : tok.trim();
            window.location.href = `${window.location.origin}/parivaar-roots/?invite=${t}`;
          }}>
          🔗 I have an invite link
        </button>
        <button className="btn btn-full" type="button"
          style={{ marginTop: 12, color: 'var(--text-3)', fontSize: 13 }}
          onClick={() => { supabase.auth.signOut(); setSession(null); setScreen('welcome'); }}>
          Sign out
        </button>
      </div>
      {toast && <div className="toast show">{toast}</div>}
    </div>
  );

  // ─── SETUP (create or join) ───────────────────────────────────────────────────
  if (screen === 'setup') {
    const isCreate = setupMode === 'create';
    return (
      <div className="app-shell">
        <div className="screen-content welcome-screen">
          <div className="hero">
            <div className="hero-logo">{isCreate ? '🏡' : '👋'}</div>
            <h1 style={{ fontSize: 26 }}>{isCreate ? 'Create your circle' : `Join ${family?.name}`}</h1>
            <p>Tell the family who you are.</p>
          </div>
          {isCreate && (
            <>
              <label className="field-label">Family circle name</label>
              <input value={newFamilyName} onChange={(e) => setNewFamilyName(e.target.value)}
                placeholder="e.g. The Santos Family" />
            </>
          )}
          <label className="field-label">Your name</label>
          <input value={setupName} onChange={(e) => setSetupName(e.target.value)}
            placeholder="e.g. Grandma Rosa" />
          <label className="field-label">Your relationship</label>
          <input value={setupRel} onChange={(e) => setSetupRel(e.target.value)}
            placeholder="e.g. Grandmother, Uncle, Cousin…" />
          <button className="btn btn-primary btn-full" type="button" style={{ marginTop: 8 }}
            disabled={saving} onClick={isCreate ? createFamily : joinFamily}>
            {saving ? 'Setting up…' : isCreate ? 'Create family circle 🌿' : 'Join the circle 🌿'}
          </button>
        </div>
        {toast && <div className="toast show">{toast}</div>}
      </div>
    );
  }

  // ─── MAIN AUTHENTICATED APP ───────────────────────────────────────────────────
  return (
    <div className="app-shell">

      {/* App bar — dashboard only */}
      {screen === 'dashboard' && (
        <div className="app-bar">
          <div className="app-logo">🌿</div>
          <div style={{ flex: 1 }}>
            <div className="app-title">{family?.name || 'Family Circle'}</div>
            <div className="app-sub">{members.length} member{members.length !== 1 ? 's' : ''}</div>
          </div>
          <button className="btn btn-primary" type="button" onClick={() => setScreen('add')}>+ Add</button>
        </div>
      )}

      {screen === 'dashboard' && <InstallBanner />}

      <div className="screen-content" style={{ paddingBottom: 90 }}>

        {/* ── DASHBOARD ── */}
        {screen === 'dashboard' && (
          <>
            {members.length > 0 && (
              <div className="chip-scroll">
                <button type="button"
                  className={`member-chip${!filterMember ? ' selected' : ''}`}
                  onClick={() => setFilterMember(null)}>All</button>
                {members.map((mb) => {
                  const { bg, fg } = getPalette(mb.name);
                  return (
                    <button type="button" key={mb.id}
                      className={`member-chip${filterMember === mb.id ? ' selected' : ''}`}
                      onClick={() => setFilterMember(filterMember === mb.id ? null : mb.id)}>
                      <span className="chip-av" style={{ background: bg, color: fg }}>
                        {initials(mb.name)}
                      </span>
                      {mb.name.split(' ')[0]}
                    </button>
                  );
                })}
              </div>
            )}

            {filteredMemories.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 16px', color: 'var(--text-3)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📖</div>
                <p>No memories yet.<br />Be the first to add one!</p>
                <button className="btn btn-primary" type="button" style={{ marginTop: 12 }}
                  onClick={() => setScreen('add')}>Add a memory</button>
              </div>
            ) : (
              filteredMemories.map((mem) => {
                const { bg, fg } = getPalette(mem.author_name);
                const tagged = taggedFor(mem);
                return (
                  <div key={mem.id} className={`card${mem.author_id === user.id ? ' mine' : ''}`}
                    onClick={() => { setDetailId(mem.id); setScreen('detail'); }}>
                    <div className="card-header">
                      <div className="avatar" style={{ background: bg, color: fg }}>
                        {initials(mem.author_name)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="card-title">{mem.title}</div>
                        <div className="card-meta">
                          {mem.type === 'voice' ? '🎙' : mem.type === 'photo' ? '📷' : mem.type === 'recipe' ? '🍳' : '✍️'} {mem.author_name} · {timeAgo(mem.created_at)}
                        </div>
                      </div>
                      <span className="feed-badge">{(mem.category || '').split(' ')[0]}</span>
                    </div>
                    {mem.type === 'photo' && mem.photo_urls?.length > 0 && (
                      <div className="photo-preview-row">
                        {mem.photo_urls.slice(0, 3).map((url, i) => (
                          <img key={i} src={url} alt="" className="photo-preview" />
                        ))}
                      </div>
                    )}
                    {mem.type === 'voice' && mem.voice_url && (
                      <p style={{ fontSize: 12, color: 'var(--green)', margin: '4px 0 6px' }}>🎙 Voice note attached</p>
                    )}
                    <p className="card-summary">
                      {(mem.content || '').slice(0, 120)}{(mem.content || '').length > 120 ? '…' : ''}
                    </p>
                    {tagged.length > 0 && (
                      <div className="tag-row">
                        {tagged.map((mb) => <span key={mb.id} className="tag">👤 {mb.name}</span>)}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </>
        )}

        {/* ── ADD MEMORY ── */}
        {screen === 'add' && (
          <>
            <div className="app-bar-sub">
              <button className="btn btn-icon btn-back" type="button" onClick={() => setScreen('dashboard')}>←</button>
              <div className="app-title">Add to the circle</div>
            </div>

            <p className="section-label">What are you sharing?</p>
            <div className="type-grid">
              {[
                { k: 'text',   i: '✍️', l: 'Story'  },
                { k: 'recipe', i: '🍳', l: 'Recipe' },
                { k: 'voice',  i: '🎙', l: 'Voice'  },
                { k: 'photo',  i: '📷', l: 'Photo'  },
              ].map(({ k, i, l }) => (
                <button type="button" key={k}
                  className={`type-btn${memType === k ? ' selected' : ''}`}
                  onClick={() => setMemType(k)}>
                  <span className="type-icon">{i}</span>
                  <span className="type-label">{l}</span>
                </button>
              ))}
            </div>

            <label className="field-label">Title</label>
            <input value={memTitle} onChange={(e) => setMemTitle(e.target.value)}
              placeholder="e.g. Sunday feijoada tradition" />

            {(memType === 'text' || memType === 'recipe') && (
              <>
                <label className="field-label">Memory</label>
                <textarea value={memContent} onChange={(e) => setMemContent(e.target.value)}
                  placeholder={memType === 'recipe' ? 'Ingredients, steps, and the secret touch…' : 'Write your memory, story or tradition…'} />
              </>
            )}

            {memType === 'voice' && (
              <>
                <label className="field-label">Voice note</label>
                <VoiceRecorder onBlob={setVoiceBlob} />
                <label className="field-label">Note (optional)</label>
                <textarea value={memContent} onChange={(e) => setMemContent(e.target.value)}
                  placeholder="Any extra context…" style={{ minHeight: 70 }} />
              </>
            )}

            {memType === 'photo' && (
              <>
                <label className="field-label">
                  Photos <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>(up to {MAX_PHOTOS})</span>
                </label>
                <PhotoUploader photos={photos} setPhotos={setPhotos} />
                <label className="field-label">Caption (optional)</label>
                <textarea value={memContent} onChange={(e) => setMemContent(e.target.value)}
                  placeholder="What's happening in these photos?" style={{ minHeight: 70 }} />
              </>
            )}

            <p className="section-label">Category</p>
            <select value={memCategory} onChange={(e) => setMemCategory(e.target.value)}>
              {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            <p className="section-label">Tag family members</p>
            <div className="member-tags">
              {members.map((mb) => {
                const { bg, fg } = getPalette(mb.name);
                const tagged = taggedIds.includes(mb.id);
                return (
                  <button type="button" key={mb.id}
                    className={`member-chip${tagged ? ' selected' : ''}`}
                    onClick={() => toggleTag(mb.id)}>
                    <span className="chip-av" style={{ background: bg, color: fg }}>
                      {initials(mb.name)}
                    </span>
                    {mb.name.split(' ')[0]}{tagged ? ' ✓' : ''}
                  </button>
                );
              })}
            </div>

            <button className="btn btn-primary btn-full" type="button"
              style={{ marginTop: 16 }} onClick={addMemory} disabled={saving}>
              {saving ? 'Saving…' : 'Share with the family circle →'}
            </button>
          </>
        )}

        {/* ── DETAIL ── */}
        {screen === 'detail' && activeMemory && (
          <>
            <div className="app-bar-sub">
              <button className="btn btn-icon btn-back" type="button" onClick={() => setScreen('dashboard')}>←</button>
              <div className="app-title">Memory</div>
            </div>

            {(() => {
              const { bg, fg } = getPalette(activeMemory.author_name);
              const tagged = taggedFor(activeMemory);
              return (
                <>
                  <div className="detail-header">
                    <div className="avatar"
                      style={{ background: bg, color: fg, width: 48, height: 48, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, flexShrink: 0 }}>
                      {initials(activeMemory.author_name)}
                    </div>
                    <div>
                      <div className="detail-title">{activeMemory.title}</div>
                      <div className="detail-meta">
                        Added by {activeMemory.author_name} · {timeAgo(activeMemory.created_at)}
                      </div>
                    </div>
                  </div>

                  <span className="feed-badge" style={{ display: 'inline-block', marginBottom: 14 }}>
                    {activeMemory.category}
                  </span>

                  {activeMemory.voice_url && (
                    <div className="audio-card">
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)', margin: '0 0 8px' }}>🎙 Voice memory</p>
                      <audio src={activeMemory.voice_url} controls style={{ width: '100%' }} />
                    </div>
                  )}

                  {activeMemory.photo_urls?.length > 0 && (
                    <div className="photo-grid" style={{ marginBottom: 16 }}>
                      {activeMemory.photo_urls.map((url, i) => (
                        <img key={i} src={url} alt="" className="photo-thumb large" />
                      ))}
                    </div>
                  )}

                  {activeMemory.content && (
                    <p className="detail-content">{activeMemory.content}</p>
                  )}

                  {tagged.length > 0 && (
                    <>
                      <p className="section-label">Tagged family members</p>
                      <div className="tag-row">
                        {tagged.map((mb) => <span key={mb.id} className="tag">👤 {mb.name}</span>)}
                      </div>
                    </>
                  )}

                  <div className="detail-actions">
                    <button className="btn" type="button" onClick={() => setShowShareModal(true)}>
                      ↗ Share outside circle
                    </button>
                    <button className="btn" type="button" onClick={() => setScreen('add')}>
                      + Add yours
                    </button>
                  </div>

                  {activeMemory.author_id === user.id && (
                    <button className="btn btn-danger btn-full" type="button"
                      style={{ marginTop: 8 }} onClick={() => deleteMemory(activeMemory.id)}>
                      Delete this memory
                    </button>
                  )}
                </>
              );
            })()}
          </>
        )}

        {/* ── CIRCLE ── */}
        {screen === 'circle' && (
          <>
            <div className="app-bar-sub">
              <div className="app-title">{family?.name}</div>
            </div>

            <div className="invite-banner" style={{ marginBottom: 10 }}>
              <div className="invite-banner-icon">🔗</div>
              <div style={{ flex: 1 }}>
                <div className="invite-title">Invite family members</div>
                <div className="invite-text">Share this link via WhatsApp, SMS, or email</div>
              </div>
            </div>
            <button className="btn btn-primary btn-full" type="button"
              style={{ marginBottom: 20 }} onClick={copyInvite}>{copyLabel}</button>

            <p className="section-label">Members — {members.length}</p>
            {members.map((mb) => {
              const { bg, fg } = getPalette(mb.name);
              return (
                <div className="card row-card" key={mb.id}>
                  <div className="avatar" style={{ background: bg, color: fg }}>
                    {initials(mb.name)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="card-title">{mb.name}</div>
                    <div className="card-meta">{mb.relationship}</div>
                  </div>
                  <span className="status-chip">{mb.role === 'admin' ? '⭐ Admin' : 'Member'}</span>
                </div>
              );
            })}

            <button className="btn btn-full" type="button"
              style={{ marginTop: 20, color: 'var(--text-3)', fontSize: 13 }}
              onClick={() => {
                supabase.auth.signOut();
                setSession(null); setFamily(null); setMember(null);
                setScreen('welcome');
              }}>Sign out</button>
          </>
        )}
      </div>

      {/* Bottom nav */}
      {['dashboard', 'add', 'detail', 'circle'].includes(screen) && (
        <nav className="nav-bar">
          {[
            { id: 'dashboard', icon: '🏠', label: 'Home'   },
            { id: 'add',       icon: '✍️', label: 'Add'    },
            { id: 'circle',    icon: '👨‍👩‍👧‍👦', label: 'Circle' },
          ].map(({ id, icon, label }) => (
            <button type="button" key={id}
              className={`nav-item${screen === id ? ' active' : ''}`}
              onClick={() => setScreen(id)}>
              <span className="nav-icon">{icon}</span>
              <span className="nav-label">{label}</span>
            </button>
          ))}
        </nav>
      )}

      {toast && <div className="toast show">{toast}</div>}

      {showShareModal && activeMemory && (
        <ShareModal
          memory={activeMemory}
          familyId={family?.id}
          onClose={() => setShowShareModal(false)}
          onToast={showToast}
        />
      )}

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
      `}</style>
    </div>
  );
}

export default App;

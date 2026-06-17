import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { supabase } from './supabaseClient';
//import { useInstallPrompt } from './useInstallPrompt';

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  'Food & Recipe',
  'Family Tradition',
  'Memory / Story',
  'Language & Expression',
  'Music & Dance',
  'Celebration & Festival',
  'Family History',
];
const MAX_PHOTOS     = 3;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_VOICE_SECS  = 180;              // 3 min
const BUCKET          = 'attachments';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const initials = (name = '') =>
  name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

const timeAgo = (iso) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const fmtDuration = (secs) => {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const getUrlParam = (key) =>
  new URLSearchParams(window.location.search).get(key) || null;

const randomToken = () =>
  Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);

const AVATAR_COLOURS = [
  { bg: '#FAECE7', fg: '#D85A30' },
  { bg: '#EAF3DE', fg: '#3B6D11' },
  { bg: '#EEEDFE', fg: '#534AB7' },
  { bg: '#FEF9C3', fg: '#92400E' },
  { bg: '#FCE7F3', fg: '#9D174D' },
  { bg: '#E0F2FE', fg: '#0369A1' },
];
const avatarColour = (str = '') =>
  AVATAR_COLOURS[str.charCodeAt(0) % AVATAR_COLOURS.length];

// ─── Story content ────────────────────────────────────────────────────────────
function StoryContent() {
  return (
    <div style={{ fontFamily: 'Lora, Georgia, serif', padding: '0 4px' }}>
      <div style={{ borderLeft: '3px solid #1D9E75', padding: '14px 18px', margin: '0 0 24px', background: '#f0fdf8', borderRadius: '0 8px 8px 0' }}>
        <p style={{ fontSize: 15, lineHeight: 1.85, color: '#1a1a2e', margin: 0, fontStyle: 'italic' }}>
          "Growing up, our family gatherings were never planned by a calendar. They just happened around a kitchen table filled with laughter, stories, and food cooked from the heart. Those precious recipes were never written down, and the wisdom told over those meals was never recorded. Today, as our families scatter across the world, those beautiful, irreplaceable traditions—the unique way you celebrate, the songs you sing, and the words only you use—are at risk of quietly disappearing. Your grandkids deserve to know where they came from.
          Parivaar is your private, sacred space to stop that drift and hand down your legacy. It is a warm, secure sanctuary built not for the public internet, but exclusively for your inner circle. By safely recording the recipes that live only in your hands, the stories behind your family rituals, and the memories of how it felt to gather, you ensure your grandkids will always know their roots. 
          Start your circle today because your family's history is the greatest gift you can give them."
        </p>
        <p style={{ fontSize: 12, color: '#888', margin: '10px 0 0' }}>— Subha, founder</p>
      </div>
      <div style={{ border: '1px solid #1D9E75', borderRadius: 12, padding: '16px 18px', margin: '0 0 20px' }}>
        <p style={{ fontSize: 14, lineHeight: 1.8, color: '#1a1a2e', margin: '0 0 8px', fontWeight: 600 }}>Every parivaar has something that belongs only to them.</p>
        <p style={{ fontSize: 14, lineHeight: 1.8, color: '#555', margin: '0 0 4px' }}>The recipe that takes all morning and tastes like no other.</p>
        <p style={{ fontSize: 14, lineHeight: 1.8, color: '#555', margin: '0 0 4px' }}>The way you decorate, gather, cook, and pray for that one celebration.</p>
        <p style={{ fontSize: 14, lineHeight: 1.8, color: '#555', margin: '0 0 4px' }}>The words only your grandmother used. The song only your family knows.</p>
        <p style={{ fontSize: 14, lineHeight: 1.8, color: '#555', margin: '0 0 4px' }}>The tradition your children think is normal — because for your parivaar, it is.</p>
        <p style={{ fontSize: 14, lineHeight: 1.8, color: '#1a1a2e', margin: '12px 0 0', fontStyle: 'italic' }}>
          Parivaar is where all of that lives — safe, private, and ready for the next generation to find.
        </p>
      </div>
      <p style={{ fontSize: 15, lineHeight: 1.85, color: '#1D9E75', margin: 0, fontWeight: 600 }}>Your parivaar's traditions deserve to survive. 🌿</p>
      <div style={{ textAlign: 'center', padding: '20px 0 4px', borderTop: '1px solid #eee', marginTop: 24 }}>
        <p style={{ fontSize: 12, color: '#aaa', margin: 0, lineHeight: 1.6 }}>
          Parivaar is private, ad-free, and built with love.<br />
          Each family circle is yours alone — no algorithms, no strangers.
        </p>
      </div>
    </div>
  );
}

// ─── Voice Recorder ───────────────────────────────────────────────────────────
function VoiceRecorder({ onRecorded, existingUrl }) {
  const [status, setStatus]   = useState('idle');
  const [elapsed, setElapsed] = useState(0);
  const [audioUrl, setAudioUrl] = useState(existingUrl || null);
  const mediaRef  = useRef(null);
  const timerRef  = useRef(null);
  const chunksRef = useRef([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const b = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(b);
        setAudioUrl(url);
        setStatus('stopped');
        onRecorded && onRecorded(b);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      setStatus('recording');
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed((e) => {
          if (e + 1 >= MAX_VOICE_SECS) { mr.stop(); clearInterval(timerRef.current); return MAX_VOICE_SECS; }
          return e + 1;
        });
      }, 1000);
    } catch {
      alert('Microphone access is needed to record voice memories.');
    }
  };

  const stopRecording = () => {
    if (mediaRef.current && mediaRef.current.state !== 'inactive') {
      mediaRef.current.stop();
      clearInterval(timerRef.current);
    }
  };

  const discard = () => {
    setAudioUrl(null); setElapsed(0); setStatus('idle');
    onRecorded && onRecorded(null);
  };

  return (
    <div style={{ background: '#f8fdf9', border: '1px solid #c8e6d0', borderRadius: 12, padding: 16, marginTop: 8 }}>
      {status === 'idle' && !audioUrl && (
        <button className="btn btn-primary btn-full" onClick={startRecording}>🎙 Start recording</button>
      )}
      {status === 'recording' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', animation: 'pulse 1s infinite', display: 'inline-block' }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#ef4444' }}>Recording…</span>
            <span style={{ fontSize: 13, color: '#666' }}>{fmtDuration(elapsed)} / {fmtDuration(MAX_VOICE_SECS)}</span>
          </div>
          <button className="btn" style={{ background: '#ef4444', color: '#fff', borderColor: '#ef4444' }} onClick={stopRecording}>⏹ Stop</button>
        </div>
      )}
      {status === 'stopped' && audioUrl && (
        <div>
          <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: '#1D9E75' }}>✅ Recorded ({fmtDuration(elapsed)})</p>
          <audio src={audioUrl} controls style={{ width: '100%', marginBottom: 8 }} />
          <button className="btn" style={{ fontSize: 12, color: '#999' }} onClick={discard}>Discard & re-record</button>
        </div>
      )}
      {status === 'idle' && audioUrl && (
        <div>
          <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: '#1D9E75' }}>🎙 Saved voice note</p>
          <audio src={audioUrl} controls style={{ width: '100%', marginBottom: 8 }} />
        </div>
      )}
      <p style={{ fontSize: 11, color: '#aaa', margin: '8px 0 0', textAlign: 'center' }}>Max {MAX_VOICE_SECS / 60} min</p>
    </div>
  );
}

// ─── Photo Uploader ───────────────────────────────────────────────────────────
function PhotoUploader({ photos, setPhotos }) {
  const inputRef = useRef(null);

  const handleFiles = (e) => {
    const files     = Array.from(e.target.files || []);
    const remaining = MAX_PHOTOS - photos.length;
    const accepted  = [];
    const rejected  = [];
    for (const f of files.slice(0, remaining)) {
      if (!f.type.startsWith('image/')) { rejected.push(`${f.name}: not an image`); continue; }
      if (f.size > MAX_PHOTO_BYTES)     { rejected.push(`${f.name}: over 5 MB`); continue; }
      accepted.push({ file: f, url: URL.createObjectURL(f) });
    }
    if (rejected.length) alert('Skipped:\n' + rejected.join('\n'));
    setPhotos((prev) => [...prev, ...accepted]);
    e.target.value = '';
  };

  const remove = (idx) => setPhotos((prev) => prev.filter((_, i) => i !== idx));

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: photos.length ? 12 : 0 }}>
        {photos.map((p, i) => (
          <div key={i} style={{ position: 'relative', width: 80, height: 80 }}>
            <img src={p.url || p.stored_url} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 10, border: '1px solid #e2e8f0' }} />
            <button onClick={() => remove(i)} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: '#ef4444', color: '#fff', border: 'none', fontSize: 12, cursor: 'pointer', lineHeight: '20px', textAlign: 'center', padding: 0 }}>✕</button>
          </div>
        ))}
        {photos.length < MAX_PHOTOS && (
          <button onClick={() => inputRef.current?.click()} style={{ width: 80, height: 80, borderRadius: 10, border: '2px dashed #1D9E75', background: '#f0fdf8', color: '#1D9E75', fontSize: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleFiles} style={{ display: 'none' }} />
      <p style={{ fontSize: 11, color: '#aaa', margin: '4px 0 0' }}>Up to {MAX_PHOTOS} photos · max 5 MB each ({photos.length}/{MAX_PHOTOS})</p>
    </div>
  );
}

// ─── Public Shared Memory View (no auth needed) ───────────────────────────────
function SharedMemoryView({ token }) {
  const [memory, setMemory]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: link } = await supabase
        .from('shared_links')
        .select('*, memories(*)')
        .eq('token', token)
        .maybeSingle();
      if (!link) { setExpired(true); setLoading(false); return; }
      if (link.expires_at && new Date(link.expires_at) < new Date()) { setExpired(true); setLoading(false); return; }
      await supabase.from('shared_links').update({ views: (link.views || 0) + 1 }).eq('token', token);
      setMemory(link.memories);
      setLoading(false);
    })();
  }, [token]);

  const hdr = { background: 'linear-gradient(160deg, #0f3460 0%, #1D9E75 100%)', padding: '32px 24px', textAlign: 'center' };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ textAlign: 'center', color: '#1D9E75' }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>🌿</div>
        <div style={{ fontFamily: 'Lora, serif' }}>Loading…</div>
      </div>
    </div>
  );

  if (expired || !memory) return (
    <div style={{ minHeight: '100vh', background: '#fafafa' }}>
      <div style={hdr}><div style={{ fontSize: 36 }}>🌿</div><h1 style={{ fontFamily: 'Lora, serif', color: '#fff', fontWeight: 400, margin: '8px 0 0' }}>Parivaar</h1></div>
      <div style={{ padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
        <h2 style={{ fontFamily: 'Lora, serif', color: '#1a1a2e' }}>This link has expired</h2>
        <p style={{ color: '#666' }}>Ask the family member to share it again.</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa' }}>
      <div style={hdr}>
        <div style={{ fontSize: 36 }}>🌿</div>
        <h1 style={{ fontFamily: 'Lora, serif', color: '#fff', fontWeight: 400, margin: '8px 0 4px' }}>Parivaar</h1>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: 0 }}>A family memory, shared with you</p>
      </div>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 20px 48px' }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 2px 16px rgba(0,0,0,0.07)' }}>
          <span style={{ display: 'inline-block', background: '#f0fdf8', color: '#1D9E75', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', padding: '3px 10px', borderRadius: 20, marginBottom: 12 }}>{memory.category}</span>
          <h2 style={{ fontFamily: 'Lora, serif', fontSize: 22, color: '#1a1a2e', margin: '0 0 6px', fontWeight: 600 }}>{memory.title}</h2>
          <p style={{ fontSize: 13, color: '#888', margin: '0 0 16px' }}>
            {memory.type === 'voice' ? '🎙' : memory.type === 'photo' ? '📷' : memory.type === 'recipe' ? '🍳' : '✍️'}&nbsp;Shared by {memory.author_name}
          </p>
          {memory.voice_url && (
            <div style={{ background: '#f0fdf8', borderRadius: 12, padding: 14, marginBottom: 16, border: '1px solid #c8e6d0' }}>
              <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: '#1D9E75' }}>🎙 Voice memory</p>
              <audio src={memory.voice_url} controls style={{ width: '100%' }} />
            </div>
          )}
          {memory.photo_urls?.length > 0 && (
            <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {memory.photo_urls.map((url, i) => (
                <img key={i} src={url} alt="" style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 12, border: '1px solid #eee' }} />
              ))}
            </div>
          )}
          {memory.content && <p style={{ fontSize: 15, lineHeight: 1.8, color: '#2d3748', fontFamily: 'Lora, Georgia, serif', margin: 0 }}>{memory.content}</p>}
        </div>
        <div style={{ textAlign: 'center', marginTop: 28 }}>
          <p style={{ fontSize: 13, color: '#aaa', lineHeight: 1.7 }}>
            This memory lives in a private family circle on Parivaar.<br />
            <a href={window.location.origin} style={{ color: '#1D9E75', textDecoration: 'none', fontWeight: 600 }}>Start preserving your family story →</a>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Share Modal ──────────────────────────────────────────────────────────────
function ShareModal({ memory, familyId, onClose, showToast }) {
  const [duration, setDuration]     = useState('7');
  const [generating, setGenerating] = useState(false);
  const [shareUrl, setShareUrl]     = useState(null);
  const [copied, setCopied]         = useState(false);

  const generate = async () => {
    setGenerating(true);
    const token     = randomToken();
    const expiresAt = duration ? new Date(Date.now() + parseInt(duration) * 86400000).toISOString() : null;
    const { error } = await supabase.from('shared_links').insert({
      memory_id: memory.id, family_id: familyId, token, expires_at: expiresAt, views: 0,
      created_at: new Date().toISOString(),
    });
    if (error) { showToast('Could not create link: ' + error.message); setGenerating(false); return; }
    setShareUrl(`${window.location.origin}${window.location.pathname}?share=${token}`);
    setGenerating(false);
  };

  const copy = () => {
    navigator.clipboard.writeText(shareUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const nativeShare = () => {
    if (navigator.share) navigator.share({ title: memory.title, text: `${memory.author_name} shared a family memory with you`, url: shareUrl });
    else copy();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', width: '100%', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ width: 36, height: 4, background: '#e2e8f0', borderRadius: 2, margin: '0 auto 20px' }} />
        <h3 style={{ fontFamily: 'Lora, serif', fontSize: 18, color: '#1a1a2e', margin: '0 0 4px' }}>Share outside the circle</h3>
        <p style={{ fontSize: 13, color: '#888', margin: '0 0 20px' }}>
          Creates a view-only link for <strong>"{memory.title}"</strong>. Your other family memories stay private.
        </p>
        {!shareUrl ? (
          <>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px' }}>Link expires after</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {[{ label: '24 hrs', val: '1' }, { label: '7 days', val: '7' }, { label: '30 days', val: '30' }, { label: 'Never', val: '' }].map(({ label, val }) => (
                <button key={label} onClick={() => setDuration(val)} style={{ flex: 1, padding: '8px 4px', fontSize: 12, borderRadius: 10, border: '1.5px solid', borderColor: duration === val ? '#1D9E75' : '#e2e8f0', background: duration === val ? '#f0fdf8' : '#fff', color: duration === val ? '#1D9E75' : '#555', fontWeight: duration === val ? 700 : 400, cursor: 'pointer' }}>{label}</button>
              ))}
            </div>
            <button className="btn btn-primary btn-full" onClick={generate} disabled={generating}>{generating ? 'Generating…' : '🔗 Create share link'}</button>
          </>
        ) : (
          <>
            <div style={{ background: '#f0fdf8', border: '1px solid #c8e6d0', borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}>
              <p style={{ fontSize: 11, color: '#888', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>Share link</p>
              <p style={{ fontSize: 12, color: '#1a1a2e', margin: 0, wordBreak: 'break-all' }}>{shareUrl}</p>
            </div>
            {duration && <p style={{ fontSize: 12, color: '#f59e0b', margin: '0 0 14px' }}>⏱ Expires in {duration === '1' ? '24 hours' : `${duration} days`}</p>}
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={nativeShare}>↗ Share via…</button>
              <button className="btn" style={{ flex: 1, borderColor: copied ? '#1D9E75' : undefined, color: copied ? '#1D9E75' : undefined }} onClick={copy}>{copied ? '✓ Copied!' : 'Copy link'}</button>
            </div>
            <button className="btn" style={{ width: '100%', fontSize: 12, color: '#aaa' }} onClick={() => setShareUrl(null)}>↺ New link</button>
          </>
        )}
        <button className="btn" style={{ width: '100%', marginTop: 10, color: '#999', fontSize: 13 }} onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  // ── URL params (read once on mount) ─────────────────────────────────────────
  const [inviteToken]  = useState(() => getUrlParam('invite'));
  const [shareToken]   = useState(() => getUrlParam('share'));

  // ── Core state ───────────────────────────────────────────────────────────────
  const [session, setSession] = useState(null);
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState(''); // <--- ADD THIS LINE
  const [email, setEmail]     = useState('');
  const [passcode, setPasscode] = useState(''); // <--- ADD THIS LINE
  const [codeSent, setCodeSent]   = useState(false);
  const [family, setFamily]   = useState(null);
  const [member, setMember]   = useState(null);
  const [members, setMembers] = useState([]);
  const [inviteValid, setInviteValid] = useState(null); // 👈 ADD THIS: null = unverified, true = valid, false = invalid

  // ── Setup state ──────────────────────────────────────────────────────────────
  const [setupName, setSetupName]                   = useState('');
  const [setupRelationship, setSetupRelationship]   = useState('');
  const [setupMode, setSetupMode]                   = useState(null);
  const [newFamilyName, setNewFamilyName]           = useState('');

  // ── Memory state ─────────────────────────────────────────────────────────────
  const [memories, setMemories]         = useState([]);
  const [filterMember, setFilterMember] = useState(null);
  const [memTitle, setMemTitle]         = useState('');
  const [memContent, setMemContent]     = useState('');
  const [memCategory, setMemCategory]   = useState(CATEGORIES[0]);
  const [memType, setMemType]           = useState('text');
  const [taggedIds, setTaggedIds]       = useState([]);
  const [voiceBlob, setVoiceBlob]       = useState(null);
  const [photos, setPhotos]             = useState([]);
  const [saving, setSaving]             = useState(false);

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [screen, setScreen]             = useState('signin');
  const [detailId, setDetailId]         = useState(null);
  const [toast, setToast]               = useState('');
  const [copyLabel, setCopyLabel]       = useState('Copy invite link');
  const [showShareModal, setShowShareModal] = useState(false);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2800);
  }, []);
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    setEmail('');
    setPasscode('');
    setCodeSent(false);
    setSession(null);
    setUser(null);
    setMember(null);
    setFamily(null);
    setScreen('signin');
  };
  /* ── PWA install prompt ───────────────────────────────────────────────────────
  const { canInstall, promptInstall, dismissInstall } = useInstallPrompt();*/
// ── Validate Invite Link on Load ────────────────────────────────────────────
  useEffect(() => {
    if (!inviteToken) {
      setInviteValid(false);
      return;
    }

    const verifyInvite = async () => {
      const { data, error } = await supabase
        .from('family_circles')
        .select('id, name')
        .eq('invite_token', inviteToken)
        .maybeSingle();

      if (error || !data) {
        console.error("Invalid or expired invite link provided.");
        setInviteValid(false);
      } else {
        setInviteValid(true);
        // Pre-populate family configuration details immediately if valid
        setFamily(data);
      }
    };

    verifyInvite();
  }, [inviteToken]);

  // ── Auth listener (always runs — no conditional hooks) ───────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    resolveFamily();
  }, [user]); // eslint-disable-line

  // ── Family resolution ────────────────────────────────────────────────────────
  const resolveFamily = async () => {
    setLoading(true);
    
    // 1. Check if user is already a member of ANY family circle
    const { data: existing } = await supabase
      .from('members')
      .select('*, family_circles(*)')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      setMember(existing);
      setFamily(existing.family_circles);
      await fetchFamilyData(existing.family_circles.id);
      setScreen('dashboard');
      setLoading(false);
      return;
    }

    // 2. If they have an invite token, check if they are already in that specific family
    if (inviteToken) {
      const { data: fc } = await supabase
        .from('family_circles').select('*').eq('invite_token', inviteToken).maybeSingle();
      
      if (fc) {
        // Double check members table to avoid duplicate key errors
        const { data: alreadyMember } = await supabase
          .from('members')
          .select('*')
          .eq('family_id', fc.id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (alreadyMember) {
          setMember(alreadyMember);
          setFamily(fc);
          await fetchFamilyData(fc.id);
          setScreen('dashboard');
        } else {
          // If genuinely new to this family, send to setup screen
          setFamily(fc);
          setSetupMode('join');
          setScreen('setup');
        }
        setLoading(false);
        return;
      }
    }

    setScreen('no-access');
    setLoading(false);
  };

  const fetchFamilyData = async (familyId) => {
    const fid = familyId || family?.id;
    if (!fid) return;
    const [{ data: mems }, { data: mems2 }] = await Promise.all([
      supabase.from('memories').select('*, memory_tags(member_id)').eq('family_id', fid).order('created_at', { ascending: false }),
      supabase.from('members').select('*').eq('family_id', fid).order('joined_at', { ascending: true }),
    ]);
    setMemories(mems ?? []);
    setMembers(mems2 ?? []);
  };

  // ── Create family ────────────────────────────────────────────────────────────
  const createFamily = async () => {
    if (!newFamilyName.trim() || !setupName.trim() || !setupRelationship.trim() || !email.trim() || !passcode.trim()) {
      showToast('Please fill in all fields and provide your verification passcode.'); 
      return;
    }
    
    setSaving(true);
    setLoadingMsg('Verifying your passcode... 🌿');

    // 1. Verify the 8-digit OTP passcode first to securely create or authenticate the user account
    const { data: authData, error: authError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: passcode.trim(),
      type: 'email'
    });

    if (authError) {
      showToast(`Verification failed: ${authError.message}`);
      setSaving(false);
      setLoadingMsg('');
      return;
    }

    const verifiedUser = authData?.user;
    if (!verifiedUser) {
      showToast('Could not verify account data.');
      setSaving(false);
      setLoadingMsg('');
      return;
    }

    // 2. Now that we guaranteed verifiedUser.id exists, build the circle safely!
    const token = randomToken();
    const { data: fc, error: fcErr } = await supabase
      .from('family_circles')
      .insert({ name: newFamilyName.trim(), invite_token: token, created_by: verifiedUser.id })
      .select().single();
    
    if (fcErr) { 
      showToast(fcErr.message); 
      setSaving(false); 
      setLoadingMsg('');
      return; 
    }

    // 3. Link them immediately as the Admin member
    const { data: newMember, error: mErr } = await supabase
      .from('members')
      .insert({ 
        family_id: fc.id, 
        user_id: verifiedUser.id, 
        name: setupName.trim(), 
        relationship: setupRelationship.trim(), 
        role: 'admin', 
        joined_at: new Date().toISOString() 
      })
      .select().single();

    if (mErr) { 
      showToast(mErr.message); 
      setSaving(false); 
      setLoadingMsg('');
      return; 
    }

    // 4. Update the core states to reflect logging in and launching into the ecosystem
    setSession(authData.session);
    setUser(verifiedUser);
    setFamily(fc);
    setMember(newMember);
    await fetchFamilyData(fc.id);
    showToast(`Welcome to ${fc.name}! You're the admin 🎉`);
    setScreen('dashboard'); // Sends them straight to the main app dashboard area
    setSaving(false);
    setLoadingMsg('');
  };

  // ── Join family ──────────────────────────────────────────────────────────────
  const joinFamily = async () => {
    if (!setupName.trim() || !setupRelationship.trim()) {
      showToast('Please enter your name and relationship.'); return;
    }
    if (!family || !user) {
      showToast('Missing family circle configuration.');
      return;
    }
    setSaving(true);
    const { count } = await supabase.from('members').select('*', { count: 'exact', head: true }).eq('family_id', family.id);
    const { data: newMember, error } = await supabase
      .from('members')
      .insert({ family_id: family.id, user_id: user.id, name: setupName.trim(), relationship: setupRelationship.trim(), role: count === 0 ? 'admin' : 'member', joined_at: new Date().toISOString() })
      .select().single();
    if (error) { showToast(error.message); setSaving(false); return; }
    setMember(newMember);
    await fetchFamilyData(family.id);
    showToast(`Welcome to ${family.name}! 🎉`);
    setScreen('dashboard');
    setSaving(false);
  };

  // ── password authentication ──────────────────────────────────────────────────────────────────
 // ── Password Authentication (Temporary) ──────────────────────────────────────
  // ── 8-Digit Email Passcode Authentication ────────────────────────────────────
  
 // Step 1: Request the code, dynamically assessing if they are an existing or new user
  const sendEmailPasscode = async () => {
    if (!email.trim()) {
      showToast('Please enter your email.');
      return;
    }

    setLoadingMsg('Checking account status... 🔍');

    try {
      const { data: existingUserRecord, error: checkError } = await supabase
        .from('members')
        .select('id, family_id')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      if (checkError) {
        console.error("Database check failed:", checkError);
      }

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
        }
      });

      if (otpError) {
        showToast(otpError.message);
        setLoadingMsg('');
        return;
      }

      if (existingUserRecord) {
        showToast('Welcome back! 8-digit passcode sent to your email. 🎉');
      } else {
        showToast('8-digit passcode sent! Create or join your circle next. 🎉');
      }

      setCodeSent(true);
    } catch (err) {
      showToast('An unexpected error occurred.');
    } finally {
      setLoadingMsg('');
    }
  };

  // Step 2: Verify the code the user typed in
  const verifyEmailPasscode = async () => {
    if (!passcode.trim()) {
      showToast('Please enter the passcode.');
      return;
    }

    setLoadingMsg('Verifying code... 🌿');

    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: passcode.trim(),
      type: 'email'
    });

    if (error) {
      showToast(error.message);
      setLoadingMsg('');
      return;
    }

    const authenticatedUser = data?.user;
    if (!authenticatedUser) {
      showToast('Authentication failed.');
      setLoadingMsg('');
      return;
    }

    setSession(data.session);
    setUser(authenticatedUser); 

    const { data: existingMember } = await supabase
      .from('members')
      .select('*, family_circles(*)')
      .eq('user_id', authenticatedUser.id)
      .maybeSingle();

    if (existingMember) {
      setMember(existingMember);
      setFamily(existingMember.family_circles);
      await fetchFamilyData(existingMember.family_circles.id);
      setScreen('dashboard');
      setLoadingMsg('');
      return;
    }

    const { data: emailMember } = await supabase
      .from('members')
      .select('*, family_circles(*)')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (emailMember) {
      await supabase
        .from('members')
        .update({ user_id: authenticatedUser.id })
        .eq('id', emailMember.id);

      emailMember.user_id = authenticatedUser.id;
      setMember(emailMember);
      setFamily(emailMember.family_circles);
      await fetchFamilyData(emailMember.family_circles.id);
      setScreen('dashboard');
      setLoadingMsg('');
      return;
    }

    if (inviteToken) {
      const { data: fc } = await supabase
        .from('family_circles').select('*').eq('invite_token', inviteToken).maybeSingle();
      if (fc) {
        setFamily(fc);
        setSetupMode('join');
        setScreen('setup');
        setLoadingMsg('');
        return;
      }
    }

    setScreen('no-access');
    setLoadingMsg('');
  };

  // Next function line should instantly be: const uploadVoice = async (memoryId) => { ...

  // ── Upload helpers ───────────────────────────────────────────────────────────
  const uploadVoice = async (memoryId) => {
    if (!voiceBlob) return null;
    const path = `voice recording/${family.id}_${memoryId}.webm`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, voiceBlob, { contentType: 'audio/webm', upsert: true });
    if (error) { showToast('Voice upload failed: ' + error.message); return null; }
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  };

  const uploadPhotos = async (memoryId) => {
    const urls = [];
    for (let i = 0; i < photos.length; i++) {
      const p = photos[i];
      if (!p.file) { urls.push(p.stored_url); continue; }
      const ext  = p.file.name.split('.').pop();
      const path = `Photos/${family.id}_${memoryId}_${i}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, p.file, { contentType: p.file.type, upsert: true });
      if (error) { showToast(`Photo ${i + 1} failed: ${error.message}`); continue; }
      urls.push(supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
    }
    return urls;
  };

  // ── Add memory ───────────────────────────────────────────────────────────────
  const addMemory = async () => {
    if (!memTitle.trim())                             { showToast('Add a title first.'); return; }
    if (memType === 'text'   && !memContent.trim())   { showToast('Write your memory.'); return; }
    if (memType === 'recipe' && !memContent.trim())   { showToast('Write your recipe.'); return; }
    if (memType === 'voice'  && !voiceBlob)           { showToast('Record a voice note first.'); return; }
    if (memType === 'photo'  && photos.length === 0)  { showToast('Add at least one photo.'); return; }

    setSaving(true);
    const { data: newMemory, error } = await supabase
      .from('memories')
      .insert({ family_id: family.id, author_id: user.id, author_name: member.name, title: memTitle.trim(), content: memContent.trim(), category: memCategory, type: memType, created_at: new Date().toISOString() })
      .select().single();
    if (error) { showToast(error.message); setSaving(false); return; }

    let voiceUrl  = null;
    let photoUrls = [];
    if (memType === 'voice') voiceUrl  = await uploadVoice(newMemory.id);
    if (memType === 'photo') photoUrls = await uploadPhotos(newMemory.id);

    if (voiceUrl || photoUrls.length) {
      await supabase.from('memories').update({ voice_url: voiceUrl || null, photo_urls: photoUrls.length ? photoUrls : null }).eq('id', newMemory.id);
    }
    if (taggedIds.length > 0) {
      await supabase.from('memory_tags').insert(taggedIds.map((mid) => ({ memory_id: newMemory.id, member_id: mid })));
    }

    showToast('Memory shared! 💚');
    setMemTitle(''); setMemContent(''); setTaggedIds([]);
    setMemCategory(CATEGORIES[0]); setMemType('text');
    setVoiceBlob(null); setPhotos([]);
    await fetchFamilyData();
    setScreen('dashboard');
    setSaving(false);
  };

  const deleteMemory = async (id) => {
    await supabase.from('memory_tags').delete().eq('memory_id', id);
    await supabase.from('memories').delete().eq('id', id);
    showToast('Memory deleted.');
    setMemories((prev) => prev.filter((m) => m.id !== id));
    setScreen('dashboard');
  };

  const toggleTag = (id) =>
    setTaggedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const copyInviteLink = () => {
    if (!family?.invite_token) return;
    const link = `${window.location.origin}${import.meta.env.BASE_URL}?invite=${family.invite_token}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopyLabel('Copied! ✓');
      setTimeout(() => setCopyLabel('Copy invite link'), 2000);
    });
  };

  // ── Derived ──────────────────────────────────────────────────────────────────
  const filteredMemories = useMemo(() => {
    if (!filterMember) return memories;
    return memories.filter((m) =>
      m.memory_tags?.some((t) => t.member_id === filterMember) ||
      m.author_id === members.find((mb) => mb.id === filterMember)?.user_id
    );
  }, [memories, filterMember, members]);

  const activeMemory = useMemo(() => memories.find((m) => m.id === detailId), [memories, detailId]);
  const taggedMembersFor = (mem) => members.filter((mb) => mem.memory_tags?.some((t) => t.member_id === mb.id));

  // ── Public share route (checked after all hooks) ─────────────────────────────
  if (shareToken && !session && !loading) {
    return <SharedMemoryView token={shareToken} />;
  }

  // ─── LOADING ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="app-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center', color: '#1D9E75' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🌿</div>
          <div style={{ fontFamily: 'Lora, serif', fontSize: 18 }}>Loading Parivaar…</div>
        </div>
      </div>
    );
  }

  // ─── SIGN IN ─────────────────────────────────────────────────────────────────
  if (!session && screen === 'signin') {
    return (
      <div style={{ maxWidth: '440px', margin: '0 auto', paddingBottom: 40 }}>
        <div style={{ background: 'linear-gradient(160deg, #0f3460 0%, #1D9E75 100%)', padding: '40px 24px 32px', textAlign: 'center', borderRadius: '0 0 20px 20px' }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>🌿</div>
          <h1 style={{ fontFamily: 'Lora, serif', fontSize: 30, color: '#fff', margin: '0 0 4px', fontWeight: 400 }}>Parivaar</h1>
          <p style={{ fontSize: 13, letterSpacing: 3, color: 'rgba(255,255,255,0.65)', margin: '0 0 10px', textTransform: 'uppercase' }}>परिवार</p>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', margin: 0, fontStyle: 'italic', fontFamily: 'Lora, serif' }}>Your family's living memory</p>
        </div>

        <div style={{ padding: '20px 16px' }}>
          
          {/* 🌿 CASE A: The Link is Completely Valid */}
          {inviteToken && inviteValid === true && (
            <div style={{ background: '#f0fdf8', border: '1px solid #c8e6d0', color: '#1D9E75', display: 'flex', gap: 10, alignItems: 'center', borderRadius: 12, padding: '12px 14px', marginBottom: 20 }}>
              <span style={{ fontSize: 20 }}>🎉</span>
              <span style={{ fontSize: 13, fontWeight: 500 }}>
                You've been invited to join the private <strong>{family?.name || 'Family'}</strong> circle!
              </span>
            </div>
          )}

          {/* ⚠️ CASE B: The Link is Broken or Dead */}
          {inviteToken && inviteValid === false && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#ef4444', display: 'flex', gap: 10, alignItems: 'center', borderRadius: 12, padding: '12px 14px', marginBottom: 20 }}>
              <span style={{ fontSize: 20 }}>⚠️</span>
              <span style={{ fontSize: 13, fontWeight: 500 }}>
                This invitation link is invalid or has expired. You can still log in to your account below.
              </span>
            </div>
          )}

          {/* Dedicated Alphanumeric OTP Input Field Panel */}
          <div className="card" style={{ padding: 20, border: '1px solid #e2e8f0', borderRadius: 16, background: '#fff', marginBottom: 24 }}>
            <p style={{ fontSize: 13, fontWeight: 'bold', color: '#0f3460', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              🔑 Member Authentication (Login / Sign Up)
            </p>
            
            {!codeSent ? (
              <>
                <p className="section-label" style={{ margin: '0 0 6px' }}>Enter Email</p>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1px solid #cbd5e1', marginBottom: 14 }} />
                <button className="btn btn-primary btn-full" onClick={sendEmailPasscode} disabled={!!loadingMsg}>
                  {loadingMsg ? loadingMsg : 'Send 8-Character Passcode →'}
                </button>
              </>
            ) : (
              <>
                <p className="section-label" style={{ margin: '0 0 6px', textAlign: 'center' }}>Enter Passcode sent to {email}</p>
                <input type="text" maxLength="8" value={passcode} onChange={(e) => setPasscode(e.target.value)} placeholder="ab12cd34" style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1px solid #cbd5e1', letterSpacing: 4, textAlign: 'center', fontSize: 20, marginBottom: 12 }} onKeyDown={(e) => e.key === 'Enter' && verifyEmailPasscode()} />
                <button className="btn btn-primary btn-full" style={{ background: '#1D9E75', borderColor: '#1D9E75' }} onClick={verifyEmailPasscode} disabled={!!loadingMsg}>
                  {loadingMsg ? loadingMsg : 'Verify Passcode & Log In →'}
                </button>
                <button style={{ display: 'block', margin: '12px auto 0', background: 'none', border: 'none', color: '#666', fontSize: 12, cursor: 'pointer' }} onClick={() => setCodeSent(false)}>← Change email</button>
              </>
            )}
          </div>

          {!inviteToken && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button className="btn btn-full" style={{ padding: '14px', fontSize: '14px', background: '#f8fafc', borderColor: '#cbd5e1', color: '#334155' }} onClick={() => { setSetupMode('create'); setScreen('setup'); }}>
                  🏡 Create a brand new family circle
                </button>

                <button className="btn btn-full" style={{ padding: '14px', fontSize: '14px', background: '#f0fdf8', borderColor: '#1D9E75', color: '#1D9E75' }}
                  onClick={() => {
                    const tok = prompt('Paste your invite link or token here:');
                    if (!tok) return;
                    const match = tok.match(/invite=([a-z0-9]+)/i);
                    const extracted = match ? match[1] : tok.trim();
                    window.location.href = `${window.location.origin}${import.meta.env.BASE_URL}?invite=${extracted}`;
                  }}>
                  🔗 I have an invite link
                </button>
              </div>
              <hr style={{ border: 'none', borderTop: '1px dashed #cbd5e1', margin: '40px 0 30px' }} />
              <StoryContent />
            </>
          )}
        </div>
        {toast && <div className="toast show">{toast}</div>}
      </div>
    );
  }

  // ─── SETUP SCREEN ────────────────────────────────────────────────────────────
  if (screen === 'setup') {
    const isCreate = setupMode === 'create';
    return (
      <div className="app-shell">
        <div style={{ background: 'linear-gradient(160deg, #0f3460 0%, #1D9E75 100%)', padding: '40px 24px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>{isCreate ? '🏡' : '👋'}</div>
          <h2 style={{ fontFamily: 'Lora, serif', fontSize: 24, color: '#fff', margin: '0 0 6px', fontWeight: 400 }}>
            {isCreate ? 'Create your circle' : `Join ${family?.name}`}
          </h2>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', margin: 0 }}>Tell the family who you are</p>
        </div>
        
        <div className="card" style={{ margin: '24px 20px 40px' }}>
          {isCreate && (
            <>
              <p className="section-label">Family circle name</p>
              <input value={newFamilyName} onChange={(e) => setNewFamilyName(e.target.value)} placeholder="e.g. The Sharma Family" />
            </>
          )}
          <p className="section-label" style={{ marginTop: isCreate ? 16 : 0 }}>Your name</p>
          <input value={setupName} onChange={(e) => setSetupName(e.target.value)} placeholder="e.g. Grandma Rosa" />
          
          <p className="section-label" style={{ marginTop: 16 }}>Your relationship</p>
          <input value={setupRelationship} onChange={(e) => setSetupRelationship(e.target.value)} placeholder="e.g. Grandmother, Uncle..." />

          {isCreate ? (
            <>
              <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '24px 0 16px' }} />
              <p style={{ fontSize: 13, fontWeight: 'bold', color: '#0f3460', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>🔒 Security Setup</p>
              
              {!codeSent ? (
                <>
                  <p className="section-label">Your Email</p>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" style={{ marginBottom: 14 }} />
                  <button className="btn btn-primary btn-full" onClick={sendEmailPasscode} disabled={saving || !!loadingMsg}>
                    {loadingMsg ? loadingMsg : 'Send 8-Digit Passcode →'}
                  </button>
                </>
              ) : (
             <>
  <p className="section-label" style={{ textAlign: 'center', marginBottom: 8 }}>Enter Passcode sent to {email}</p>
  <input 
    type="text" 
    maxLength="8" 
    value={passcode} 
    onChange={(e) => setPasscode(e.target.value)} 
    placeholder="ab12cd34" 
    style={{ letterSpacing: 4, textAlign: 'center', fontSize: 20, marginBottom: 14 }} 
    onKeyDown={(e) => e.key === 'Enter' && createFamily()} 
  />
  <button className="btn btn-primary btn-full" onClick={createFamily} disabled={saving || !!loadingMsg}>
    {loadingMsg ? loadingMsg : 'Verify Passcode & Create Circle 🌿'}
  </button>
  <button style={{ display: 'block', margin: '12px auto 0', background: 'none', border: 'none', color: '#666', fontSize: 12, cursor: 'pointer' }} onClick={() => setCodeSent(false)}>← Change details</button>
</>
              )}
            </>
          ) : (
            <button className="btn btn-primary btn-full" style={{ marginTop: 20 }} disabled={saving} onClick={joinFamily}>
              {saving ? 'Setting up…' : 'Join the family circle 🌿'}
            </button>
          )}

          <button className="btn btn-full" style={{ marginTop: 12, background: '#f8fafc', color: '#64748b', borderColor: '#cbd5e1' }} onClick={() => { setScreen('signin'); setCodeSent(false); }} disabled={saving}>
            Cancel
          </button>
        </div>
        {toast && <div className="toast show">{toast}</div>}
      </div>
    );
  }

  // ─── NO ACCESS / ORPHAN USER SCREEN ──────────────────────────────────────────
  if (screen === 'no-access') {
    return (
      <div className="app-shell" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🌿</div>
        <h2 style={{ fontFamily: 'Lora, serif', color: '#1a1a2e', marginBottom: 8, textAlign: 'center' }}>Welcome to Parivaar</h2>
        <p style={{ color: '#666', textAlign: 'center', maxWidth: 300, marginBottom: 28, lineHeight: 1.7 }}>
          Start a new family circle, or ask a family member for their invite link to join theirs.
        </p>
        
        <button className="btn btn-primary btn-full" style={{ maxWidth: 300, marginBottom: 12 }} onClick={() => { setSetupMode('create'); setScreen('setup'); }}>
          🏡 Create a family circle
        </button>
        
        <button className="btn btn-full" style={{ maxWidth: 300, marginBottom: 24, background: '#f0fdf8', borderColor: '#1D9E75', color: '#1D9E75' }}
          onClick={() => {
            const tok = prompt('Paste your invite link or token here:');
            if (!tok) return;
            const match = tok.match(/invite=([a-z0-9]+)/i);
            const extracted = match ? match[1] : tok.trim();
            window.location.href = `${window.location.origin}${import.meta.env.BASE_URL}?invite=${extracted}`;
          }}>
          🔗 I have an invite link
        </button>
        
        <button className="btn" style={{ color: '#999', fontSize: 13 }} onClick={() => { supabase.auth.signOut(); setScreen('signin'); setSession(null); }}>
          Sign out
        </button>
        
        {toast && <div className="toast show">{toast}</div>}
      </div>
    );
  }

  // ─── CORE RENDERING LOGIC (AUTHENTICATED DASHBOARD ENVIRONMENTS) ───────────────
  return (
    <div className="app-shell">
      <div className="scroll-area" style={{ paddingBottom: ['dashboard', 'add', 'detail', 'circle'].includes(screen) ? 80 : 20 }}>
        
        {screen === 'dashboard' && (
          <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0 16px 40px' }}>
            {/* Header Area */}
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 0 16px', borderBottom: '1px solid #f1f5f9' }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: '#1D9E75', textTransform: 'uppercase' }}>
                  PARIVAAR • {family?.name?.toUpperCase() || 'FAMILY'}
                </span>
                <h1 style={{ margin: '4px 0 0', fontFamily: 'Lora, serif', fontSize: 26, color: '#1a1a2e', fontWeight: 600 }}>
                  Living Memories
                </h1>
              </div>
              <button 
                onClick={() => setScreen('circle')}
                style={{ width: 42, height: 42, borderRadius: '50%', background: '#f0fdf8', border: '1px solid #1D9E75', color: '#1D9E75', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
              >
                {initials(member?.name || user?.email)}
              </button>
            </header>

            {inviteToken && !member && (
              <div style={{ background: '#fef3c7', border: '1px solid #fde68a', color: '#b45309', borderRadius: 12, padding: '12px 16px', margin: '16px 0', fontSize: 13, fontWeight: 500 }}>
                <span>Processing your entry into the circle...</span>
              </div>
            )}

            {/* Horizontal Filter Bar */}
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '16px 0 20px', whiteSpace: 'nowrap', WebkitOverflowScrolling: 'touch' }}>
              <button 
                style={{ 
                  padding: '8px 16px', borderRadius: 20, border: '1px solid', fontSize: 13, cursor: 'pointer',
                  borderColor: !filterMember ? '#1D9E75' : '#e2e8f0',
                  background: !filterMember ? '#1D9E75' : '#fff',
                  color: !filterMember ? '#fff' : '#555',
                  fontWeight: !filterMember ? 600 : 400
                }} 
                onClick={() => setFilterMember(null)}
              >
                All
              </button>
              {CATEGORIES.map((c) => (
                <button 
                  key={c} 
                  style={{ 
                    padding: '8px 16px', borderRadius: 20, border: '1px solid', fontSize: 13, cursor: 'pointer',
                    borderColor: filterMember === c ? '#1D9E75' : '#e2e8f0',
                    background: filterMember === c ? '#1D9E75' : '#fff',
                    color: filterMember === c ? '#fff' : '#555',
                    fontWeight: filterMember === c ? 600 : 400
                  }} 
                  onClick={() => setFilterMember(c)}
                >
                  {c}
                </button>
              ))}
            </div>

            {/* Memories List Wrapper */}
            <div>
              {filteredMemories.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999', background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>✨</div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: '#1a1a2e' }}>No memories posted here yet.</p>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#888' }}>Be the first to preserve a moment!</p>
                </div>
              ) : (
                filteredMemories.map((m) => (
                  <div 
                    key={m.id} 
                    style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 18, marginBottom: 14, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', transition: 'transform 0.2s' }} 
                    onClick={() => { setDetailId(m.id); setScreen('detail'); }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#1D9E75', textTransform: 'uppercase', letterSpacing: 0.5 }}>{m.category}</span>
                    <h3 style={{ margin: '6px 0', fontFamily: 'Lora, serif', fontSize: 18, color: '#1a1a2e', fontWeight: 600 }}>{m.title}</h3>
                    <p style={{ margin: 0, fontSize: 12, color: '#666' }}>By {m.author_name} · {timeAgo(m.created_at)}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

    {/* ─── SCREEN: ADD MEMORY ─── */}
        {screen === 'add' && (
          <div className="card" style={{ margin: '20px 16px 40px', padding: 20 }}>
            <h2 style={{ fontFamily: 'Lora, serif', fontSize: 22, color: '#1a1a2e', marginBottom: 18 }}>Preserve a Memory</h2>
            
            <p className="section-label">Memory Title</p>
            <input 
              type="text" 
              value={memTitle} 
              onChange={(e) => setMemTitle(e.target.value)} 
              placeholder="e.g., Nani's Secret Cardamom Chai" 
              style={{ marginBottom: 16 }}
            />

            <p className="section-label">Category</p>
            <select 
              value={memCategory} 
              onChange={(e) => setMemCategory(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', fontSize: 14, marginBottom: 16 }}
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <p className="section-label">Memory Type</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[
                { type: 'text', label: '✍️ Story' },
                { type: 'recipe', label: '🍳 Recipe' },
                { type: 'voice', label: '🎙 Voice' },
                { type: 'photo', label: '📷 Photo Gallery' }
              ].map((t) => (
                <button 
                  key={t.type} 
                  type="button"
                  className={`filter-tag ${memType === t.type ? 'active' : ''}`}
                  onClick={() => setMemType(t.type)}
                  style={{ flex: 1, textAlign: 'center', justifyContent: 'center', margin: 0, padding: '8px 0', fontSize: 12 }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Dynamic Inputs based on selection */}
            {(memType === 'text' || memType === 'recipe') && (
              <>
                <p className="section-label">{memType === 'recipe' ? 'Ingredients & Steps' : 'The Story'}</p>
                <textarea 
                  rows="6" 
                  value={memContent} 
                  onChange={(e) => setMemContent(e.target.value)} 
                  placeholder={memType === 'recipe' ? 'List the ingredients and adjustments made by hand...' : 'Capture the moments, expressions, and atmosphere...'}
                  style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid #e2e8f0', fontFamily: 'Lora, serif', fontSize: 14, lineHeight: 1.6, resize: 'vertical', marginBottom: 16 }}
                />
              </>
            )}

            {memType === 'voice' && (
              <div style={{ marginBottom: 16 }}>
                <p className="section-label">Voice Note</p>
                <VoiceRecorder onRecorded={(blob) => setVoiceBlob(blob)} existingUrl={null} />
              </div>
            )}

            {memType === 'photo' && (
              <div style={{ marginBottom: 16 }}>
                <p className="section-label">Upload Pictures</p>
                <PhotoUploader photos={photos} setPhotos={setPhotos} />
              </div>
            )}

            {/* Tag Family Members */}
            {members.length > 1 && (
              <div style={{ marginBottom: 20 }}>
                <p className="section-label">Tag Family Members</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  {members.filter(m => m.user_id !== user.id).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleTag(m.id)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 20,
                        border: '1px solid',
                        fontSize: 12,
                        cursor: 'pointer',
                        borderColor: taggedIds.includes(m.id) ? '#1D9E75' : '#e2e8f0',
                        background: taggedIds.includes(m.id) ? '#f0fdf8' : '#fff',
                        color: taggedIds.includes(m.id) ? '#1D9E75' : '#555'
                      }}
                    >
                      {m.name} ({m.relationship})
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button className="btn btn-primary btn-full" onClick={addMemory} disabled={saving}>
              {saving ? 'Uploading to Circle... 🌿' : 'Share with Family Circle →'}
            </button>
            <button className="btn btn-full" style={{ marginTop: 10, background: 'none', border: 'none', color: '#666' }} onClick={() => setScreen('dashboard')}>Cancel</button>
          </div>
        )}

        {/* ─── SCREEN: MEMORY DETAIL ─── */}
        {screen === 'detail' && activeMemory && (
          <div className="card" style={{ margin: '20px 16px 40px', padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#1D9E75', textTransform: 'uppercase', letterSpacing: 0.5 }}>{activeMemory.category}</span>
              <button 
                onClick={() => setShowShareModal(true)}
                style={{ background: '#f0fdf8', border: '1px solid #c8e6d0', color: '#1D9E75', padding: '4px 10px', borderRadius: 12, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
              >
                🔗 Share Out
              </button>
            </div>

            <h2 style={{ fontFamily: 'Lora, serif', fontSize: 24, color: '#1a1a2e', margin: '0 0 8px' }}>{activeMemory.title}</h2>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#666' }}>
              Preserved by <strong>{activeMemory.author_name}</strong> · {timeAgo(activeMemory.created_at)}
            </p>

            {/* Media Content blocks */}
            {activeMemory.voice_url && (
              <div style={{ background: '#f0fdf8', borderRadius: 12, padding: 14, marginBottom: 20, border: '1px solid #c8e6d0' }}>
                <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#1D9E75' }}>🎙 VOICE CLIP</p>
                <audio src={activeMemory.voice_url} controls style={{ width: '100%' }} />
              </div>
            )}

            {activeMemory.photo_urls?.length > 0 && (
              <div style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {activeMemory.photo_urls.map((url, i) => (
                  <img key={i} src={url} alt="" style={{ width: '100%', maxHeight: 280, objectFit: 'cover', borderRadius: 12, border: '1px solid #eee' }} />
                ))}
              </div>
            )}

            {activeMemory.content && (
              <p style={{ fontSize: 15, lineHeight: 1.8, color: '#2d3748', fontFamily: 'Lora, Georgia, serif', whiteSpace: 'pre-wrap', margin: '0 0 24px' }}>
                {activeMemory.content}
              </p>
            )}

            {/* Tagged Members display list */}
            {taggedMembersFor(activeMemory).length > 0 && (
              <div style={{ borderTop: '1px solid #eee', paddingTop: 14, marginBottom: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', marginBottom: 6 }}>Tagged in this memory</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {taggedMembersFor(activeMemory).map(mb => (
                    <span key={mb.id} style={{ background: '#f1f5f9', color: '#475569', fontSize: 12, padding: '4px 10px', borderRadius: 12 }}>
                      {mb.name} ({mb.relationship})
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, borderTop: '1px solid #eee', paddingTop: 16 }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => setScreen('dashboard')}>← Back Home</button>
              {(activeMemory.author_id === user.id || member?.role === 'admin') && (
                <button 
                  className="btn" 
                  style={{ color: '#ef4444', borderColor: '#fee2e2', background: '#fef2f2' }} 
                  onClick={() => window.confirm('Delete this memory permanently?') && deleteMemory(activeMemory.id)}
                >
                  🗑 Delete
                </button>
              )}
            </div>
          </div>
        )}

        {/* ─── SCREEN: CIRCLE MANAGEMENT ─── */}
        {screen === 'circle' && (
          <div className="card" style={{ margin: '20px 16px 40px', padding: 20 }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: avatarColour(family?.name).bg, color: avatarColour(family?.name).fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 'bold', margin: '0 auto 12px' }}>
                🏡
              </div>
              <h2 style={{ fontFamily: 'Lora, serif', fontSize: 22, color: '#1a1a2e', margin: '0 0 4px' }}>{family?.name}</h2>
              <p style={{ fontSize: 12, color: '#888', margin: 0 }}>Private Family Circle</p>
            </div>

            {/* Invite generation interface panel */}
            <div style={{ background: '#f0fdf8', border: '1px solid #c8e6d0', borderRadius: 12, padding: 16, marginBottom: 24 }}>
              <h4 style={{ margin: '0 0 4px', color: '#1D9E75', fontSize: 14 }}>Bring in your Family</h4>
              <p style={{ fontSize: 12, color: '#555', margin: '0 0 12px', lineHeight: 1.5 }}>Share this private link with elders, siblings, or kids to invite them into this vault.</p>
              <button className="btn btn-primary btn-full" style={{ background: '#1D9E75', borderColor: '#1D9E75', fontSize: 13 }} onClick={copyInviteLink}>
                {copyLabel}
              </button>
            </div>

            <h3 style={{ fontSize: 14, color: '#1a1a2e', marginBottom: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Circle Members ({members.length})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
              {members.map((m) => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: avatarColour(m.name).bg, color: avatarColour(m.name).fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>
                    {initials(m.name)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>{m.name} {m.user_id === user.id && ' (You)'}</p>
                    <p style={{ margin: 0, fontSize: 12, color: '#666' }}>{m.relationship} · <span style={{ textTransform: 'capitalize', color: m.role === 'admin' ? '#1D9E75' : '#666', fontWeight: m.role === 'admin' ? 600 : 400 }}>{m.role}</span></p>
                  </div>
                </div>
              ))}
            </div>

            <button className="btn btn-full" style={{ background: '#fee2e2', color: '#ef4444', borderColor: '#fca5a5', fontWeight: 600 }} onClick={handleSignOut}>
              🚪 Secure Sign Out
            </button>
          </div>
        )}
      </div>

      {['dashboard', 'add', 'detail', 'circle'].includes(screen) && (
        <nav className="nav-bar">
          <button className={`nav-item ${screen === 'dashboard' ? 'active' : ''}`} onClick={() => setScreen('dashboard')}>
            <span className="nav-icon">🏠</span><span className="nav-label">Home</span>
          </button>
          <button className={`nav-item ${screen === 'add' ? 'active' : ''}`} onClick={() => setScreen('add')}>
            <span className="nav-icon">✍️</span><span className="nav-label">Add</span>
          </button>
          <button className={`nav-item ${screen === 'circle' ? 'active' : ''}`} onClick={() => setScreen('circle')}>
            <span className="nav-icon">👨‍👩‍👧‍👦</span><span className="nav-label">Circle</span>
          </button>
        </nav>
      )}

      {toast && <div className="toast show">{toast}</div>}

      {showShareModal && activeMemory && (
        <ShareModal memory={activeMemory} familyId={family?.id} onClose={() => setShowShareModal(false)} showToast={showToast} />
      )}
    </div>
  );
}
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
          "Growing up, there was always something happening. A festival, a birthday, a Sunday that needed no reason at all.
          And there was always food — made by my mother and aunts, cooked with a kind of love that filled the whole house
          before the meal even reached the table."
        </p>
        <p style={{ fontSize: 12, color: '#888', margin: '10px 0 0' }}>— Subha, founder</p>
      </div>
      <p style={{ fontSize: 15, lineHeight: 1.85, color: '#2d3748', margin: '0 0 16px' }}>
        Those gatherings were never planned with a calendar. They just happened — because family meant showing up.
        Every week, someone's kitchen became the centre of the world. The recipes were never written down.
        The stories told over those meals were never recorded.
      </p>
      <p style={{ fontSize: 15, lineHeight: 1.85, color: '#2d3748', margin: '0 0 16px' }}>
        Every family has something that belongs only to them. A spice blend that belongs to no cookbook.
        A way of celebrating that is entirely, uniquely theirs. The way your family has always done something —
        that particular, irreplaceable way — that quietly disappears when it is not captured.
      </p>
      <div style={{ background: '#f8faff', borderRadius: 12, padding: '16px 18px', margin: '0 0 20px', border: '1px solid #e2e8f0' }}>
        <p style={{ fontSize: 14, lineHeight: 1.8, color: '#2d3748', margin: '0 0 10px' }}>
          We live in a world that moves faster than memory. Families scatter across cities and continents.
          The elders who carried entire histories inside them leave before we think to ask.
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.8, color: '#2d3748', margin: 0 }}>
          We are the most connected generation in history — and somehow, the most at risk of forgetting where we came from.
        </p>
      </div>
      <p style={{ fontSize: 15, lineHeight: 1.85, color: '#2d3748', margin: '0 0 16px' }}>
        Parivaar was built as a quiet act of resistance to that drift. A private, warm space where your family can
        capture the things that belong only to you — the recipe that exists only in someone's hands, the tradition
        that marks how your family celebrates, the story behind the dish, the meaning behind the ritual.
      </p>
      <p style={{ fontSize: 15, lineHeight: 1.85, color: '#2d3748', margin: '0 0 20px' }}>
        Not to share with the world. To pass down to the next generation. So that your grandchildren know not
        just <em>what</em> you cooked, but <em>why</em>. Not just <em>how</em> you celebrated, but <em>what it felt like</em> to be there.
      </p>
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
  const [email, setEmail]     = useState('');

  const [family, setFamily]   = useState(null);
  const [member, setMember]   = useState(null);
  const [members, setMembers] = useState([]);

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
  const [screen, setScreen]             = useState('story');
  const [detailId, setDetailId]         = useState(null);
  const [toast, setToast]               = useState('');
  const [copyLabel, setCopyLabel]       = useState('Copy invite link');
  const [showShareModal, setShowShareModal] = useState(false);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2800);
  }, []);

  /* ── PWA install prompt ───────────────────────────────────────────────────────
  const { canInstall, promptInstall, dismissInstall } = useInstallPrompt();*/

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
    if (!newFamilyName.trim() || !setupName.trim() || !setupRelationship.trim()) {
      showToast('Please fill in all fields.'); return;
    }
    setSaving(true);
    const token = randomToken();
    const { data: fc, error: fcErr } = await supabase
      .from('family_circles')
      .insert({ name: newFamilyName.trim(), invite_token: token, created_by: user.id })
      .select().single();
    if (fcErr) { showToast(fcErr.message); setSaving(false); return; }

    const { data: newMember, error: mErr } = await supabase
      .from('members')
      .insert({ family_id: fc.id, user_id: user.id, name: setupName.trim(), relationship: setupRelationship.trim(), role: 'admin', joined_at: new Date().toISOString() })
      .select().single();
    if (mErr) { showToast(mErr.message); setSaving(false); return; }

    setFamily(fc);
    setMember(newMember);
    await fetchFamilyData(fc.id);
    showToast(`Welcome to ${fc.name}! You're the admin 🎉`);
    setScreen('circle');
    setSaving(false);
  };

  // ── Join family ──────────────────────────────────────────────────────────────
  const joinFamily = async () => {
    if (!setupName.trim() || !setupRelationship.trim()) {
      showToast('Please enter your name and relationship.'); return;
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

  // ── Sign in ──────────────────────────────────────────────────────────────────
  const signIn = async () => {
    if (!email.trim()) { showToast('Enter your email.'); return; }
    const base = `${window.location.origin}${import.meta.env.BASE_URL}`;
    const redirectTo = inviteToken ? `${base}?invite=${inviteToken}` : base;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    });
    if (error) { showToast(error.message); return; }
    showToast('Magic link sent — check your inbox ✉️');
  };

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
   // const link = `${window.location.origin}${window.location.pathname}?invite=${family.invite_token}`;
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

  // ─── STORY ───────────────────────────────────────────────────────────────────
  if (!session && screen === 'story') {
    return (
      <div className="app-shell">
        <div style={{ background: 'linear-gradient(160deg, #0f3460 0%, #1D9E75 100%)', padding: '40px 24px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>🌿</div>
          <h1 style={{ fontFamily: 'Lora, serif', fontSize: 30, color: '#fff', margin: '0 0 4px', fontWeight: 400 }}>Parivaar</h1>
          <p style={{ fontSize: 13, letterSpacing: 3, color: 'rgba(255,255,255,0.65)', margin: '0 0 10px', textTransform: 'uppercase' }}>परिवार</p>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', margin: 0, fontStyle: 'italic', fontFamily: 'Lora, serif' }}>Your family's living memory</p>
        </div>
        <div style={{ padding: '24px 20px 140px' }}><StoryContent /></div>
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #eee', padding: '16px 20px 24px', boxShadow: '0 -4px 20px rgba(0,0,0,0.08)' }}>
          {inviteToken && <p style={{ margin: '0 0 10px', textAlign: 'center', fontSize: 13, color: '#1D9E75', fontWeight: 600 }}>🎉 You've been invited to join a family circle</p>}
          <button className="btn btn-primary btn-full" onClick={() => setScreen('signin')}>{inviteToken ? 'Join your parivaar →' : 'Get started →'}</button>
          <p style={{ fontSize: 11, color: '#bbb', textAlign: 'center', margin: '8px 0 0' }}>Private · Ad-free · Built with love</p>
        </div>
        {toast && <div className="toast show">{toast}</div>}
      </div>
    );
  }

  // ─── SIGN IN ─────────────────────────────────────────────────────────────────
  if (!session && screen === 'signin') {
    return (
      <div className="app-shell">
        <div style={{ background: 'linear-gradient(160deg, #0f3460 0%, #1D9E75 100%)', padding: '40px 24px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>🌿</div>
          <h1 style={{ fontFamily: 'Lora, serif', fontSize: 30, color: '#fff', margin: '0 0 4px', fontWeight: 400 }}>Parivaar</h1>
          <p style={{ fontSize: 13, letterSpacing: 3, color: 'rgba(255,255,255,0.65)', margin: 0, textTransform: 'uppercase' }}>परिवार</p>
        </div>
        <div className="card" style={{ margin: '24px 20px 0' }}>
          {inviteToken && <div className="invite-banner" style={{ marginBottom: 16 }}><span style={{ fontSize: 20 }}>🎉</span><span>You've been invited to join a family circle!</span></div>}
          <p className="section-label">Sign in with your email</p>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" onKeyDown={(e) => e.key === 'Enter' && signIn()} />
          <button className="btn btn-primary btn-full" style={{ marginTop: 12 }} onClick={signIn}>Send magic link →</button>
          <p style={{ fontSize: 12, color: '#999', textAlign: 'center', marginTop: 12 }}>No password needed — we'll email you a sign-in link.</p>
        </div>
        <button style={{ display: 'block', margin: '16px auto 0', background: 'none', border: 'none', color: '#1D9E75', fontSize: 13, cursor: 'pointer' }} onClick={() => setScreen('story')}>← Read our story</button>
        {toast && <div className="toast show">{toast}</div>}
      </div>
    );
  }

  // ─── NO ACCESS ───────────────────────────────────────────────────────────────
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
            const match     = tok.match(/invite=([a-z0-9]+)/i);
            const extracted = match ? match[1] : tok.trim();
            window.location.href = `${window.location.origin}${import.meta.env.BASE_URL}?invite=${extracted}`;
          }}>
          🔗 I have an invite link
        </button>
        <button className="btn" style={{ color: '#999', fontSize: 13 }} onClick={() => { supabase.auth.signOut(); setScreen('story'); setSession(null); }}>Sign out</button>
        {toast && <div className="toast show">{toast}</div>}
      </div>
    );
  }

  // ─── SETUP ───────────────────────────────────────────────────────────────────
  if (screen === 'setup') {
    const isCreate = setupMode === 'create';
    return (
      <div className="app-shell">
        <div style={{ background: 'linear-gradient(160deg, #0f3460 0%, #1D9E75 100%)', padding: '40px 24px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>{isCreate ? '🏡' : '👋'}</div>
          <h2 style={{ fontFamily: 'Lora, serif', fontSize: 24, color: '#fff', margin: '0 0 6px', fontWeight: 400 }}>{isCreate ? 'Create your circle' : `Join ${family?.name}`}</h2>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', margin: 0 }}>Tell the family who you are</p>
        </div>
        <div className="card" style={{ margin: '24px 20px 0' }}>
          {isCreate && (
            <><p className="section-label">Family circle name</p><input value={newFamilyName} onChange={(e) => setNewFamilyName(e.target.value)} placeholder="e.g. The Sharma Family" /></>
          )}
          <p className="section-label" style={{ marginTop: isCreate ? 16 : 0 }}>Your name</p>
          <input value={setupName} onChange={(e) => setSetupName(e.target.value)} placeholder="e.g. Grandma Rosa" />
          <p className="section-label" style={{ marginTop: 16 }}>Your relationship</p>
          <input value={setupRelationship} onChange={(e) => setSetupRelationship(e.target.value)} placeholder="e.g. Grandmother, Uncle, Cousin…" />
          <button className="btn btn-primary btn-full" style={{ marginTop: 20 }} disabled={saving} onClick={isCreate ? createFamily : joinFamily}>
            {saving ? 'Setting up…' : isCreate ? 'Create family circle 🌿' : 'Join the family circle 🌿'}
          </button>
        </div>
        {toast && <div className="toast show">{toast}</div>}
      </div>
    );
  }

  // ─── ABOUT ───────────────────────────────────────────────────────────────────
  if (screen === 'about') {
    return (
      <div className="app-shell">
        <div style={{ background: 'linear-gradient(160deg, #0f3460 0%, #1D9E75 100%)', padding: '40px 24px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>🌿</div>
          <h1 style={{ fontFamily: 'Lora, serif', fontSize: 28, color: '#fff', margin: '0 0 4px', fontWeight: 400 }}>Why Parivaar</h1>
        </div>
        <div style={{ padding: '24px 20px 100px' }}><StoryContent /></div>
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #eee', padding: '12px 20px 24px' }}>
          <button className="btn btn-primary btn-full" onClick={() => setScreen('circle')}>← Back to circle</button>
        </div>
        {toast && <div className="toast show">{toast}</div>}
      </div>
    );
  }

  // ─── MAIN AUTHENTICATED APP ───────────────────────────────────────────────────
  return (
    <div className="app-shell">

      {/* App bar (dashboard only) */}
      {screen === 'dashboard' && (
        <div className="app-bar">
          <div>
            <div className="app-title">{family?.name || 'Family Circle'}</div>
            <div className="app-sub">{members.length} member{members.length !== 1 ? 's' : ''}</div>
          </div>
          <button className="btn btn-primary" onClick={() => setScreen('add')}>+ Memory</button>
        </div>
      )}

      <div className="scroll-area">

        {/* ── DASHBOARD ── */}
        {screen === 'dashboard' && <InstallBanner/>}
        {/* Member filter chips */}
            {members.length > 0 && (
              <div style={{ display: 'flex', gap: 8, padding: '12px 20px', overflowX: 'auto' }}>
                <button className={`member-chip ${!filterMember ? 'selected' : ''}`} onClick={() => setFilterMember(null)}>All</button>
                {members.map((mb) => {
                  const col = avatarColour(mb.name);
                  return (
                    <button key={mb.id} className={`member-chip ${filterMember === mb.id ? 'selected' : ''}`} onClick={() => setFilterMember(filterMember === mb.id ? null : mb.id)}>
                      <span className="chip-av" style={{ background: col.bg, color: col.fg }}>{initials(mb.name)}</span>
                      {mb.name.split(' ')[0]}
                    </button>
                  );
                })}
              </div>
            )}

            {filteredMemories.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 32px', color: '#aaa' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📖</div>
                <p style={{ fontFamily: 'Lora, serif' }}>No memories yet.<br />Be the first to add one!</p>
                <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setScreen('add')}>Add a memory</button>
              </div>
            ) : (
              filteredMemories.map((mem) => {
                const col    = avatarColour(mem.author_name);
                const tagged = taggedMembersFor(mem);
                return (
                  <div key={mem.id} className="card" style={{ margin: '0 16px 12px', cursor: 'pointer' }} onClick={() => { setDetailId(mem.id); setScreen('detail'); }}>
                    <div className="card-header">
                      <div className="avatar" style={{ background: col.bg, color: col.fg }}>{initials(mem.author_name)}</div>
                      <div style={{ flex: 1 }}>
                        <div className="card-title">{mem.title}</div>
                        <div className="card-meta">
                          {mem.type === 'voice' ? '🎙' : mem.type === 'photo' ? '📷' : mem.type === 'recipe' ? '🍳' : '✍️'}&nbsp;
                          {mem.author_name} · {timeAgo(mem.created_at)}
                        </div>
                      </div>
                      <span className="feed-badge">{mem.category?.split(' ')[0]}</span>
                    </div>
                    {mem.type === 'photo' && mem.photo_urls?.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, margin: '8px 0' }}>
                        {mem.photo_urls.slice(0, 3).map((url, i) => <img key={i} src={url} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8 }} />)}
                      </div>
                    )}
                    {mem.type === 'voice' && mem.voice_url && (
                      <div style={{ fontSize: 12, color: '#1D9E75', margin: '6px 0' }}>🎙 Voice note attached</div>
                    )}
                    <p className="card-summary">{mem.content?.slice(0, 120)}{mem.content?.length > 120 ? '…' : ''}</p>
                    {tagged.length > 0 && <div className="tag-row">{tagged.map((mb) => <span key={mb.id} className="tag">👤 {mb.name}</span>)}</div>}
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
              <button className="btn btn-icon btn-back" onClick={() => setScreen('dashboard')}>←</button>
              <div className="app-title">Add a memory</div>
            </div>
            <div style={{ padding: '0 20px' }}>
              <p className="section-label">Type</p>
              <div className="type-grid">
                {[{ key: 'text', icon: '✍️', label: 'Story' }, { key: 'recipe', icon: '🍳', label: 'Recipe' }, { key: 'voice', icon: '🎙', label: 'Voice' }, { key: 'photo', icon: '📷', label: 'Photo' }].map(({ key, icon, label }) => (
                  <button key={key} className={`type-btn ${memType === key ? 'selected' : ''}`} onClick={() => setMemType(key)}>
                    <span className="type-icon">{icon}</span>
                    <span className="type-label">{label}</span>
                  </button>
                ))}
              </div>

              <p className="section-label">Title</p>
              <input value={memTitle} onChange={(e) => setMemTitle(e.target.value)} placeholder="e.g. Sunday feijoada tradition" />

              {(memType === 'text' || memType === 'recipe') && (
                <><p className="section-label" style={{ marginTop: 16 }}>Memory</p>
                <textarea value={memContent} onChange={(e) => setMemContent(e.target.value)} placeholder={memType === 'recipe' ? 'Ingredients, steps, and the secret touch…' : 'Write your memory, story, or tradition here…'} rows={5} style={{ width: '100%', resize: 'vertical' }} /></>
              )}

              {memType === 'voice' && (
                <><p className="section-label" style={{ marginTop: 16 }}>Voice note</p>
                <VoiceRecorder onRecorded={setVoiceBlob} />
                <p className="section-label" style={{ marginTop: 16 }}>Note (optional)</p>
                <textarea value={memContent} onChange={(e) => setMemContent(e.target.value)} placeholder="Any extra context…" rows={3} style={{ width: '100%', resize: 'vertical' }} /></>
              )}

              {memType === 'photo' && (
                <><p className="section-label" style={{ marginTop: 16 }}>Photos <span style={{ fontSize: 11, color: '#aaa', fontWeight: 400 }}>(up to {MAX_PHOTOS})</span></p>
                <PhotoUploader photos={photos} setPhotos={setPhotos} />
                <p className="section-label" style={{ marginTop: 16 }}>Caption (optional)</p>
                <textarea value={memContent} onChange={(e) => setMemContent(e.target.value)} placeholder="What's happening in these photos?" rows={3} style={{ width: '100%', resize: 'vertical' }} /></>
              )}

              <p className="section-label" style={{ marginTop: 16 }}>Category</p>
              <select value={memCategory} onChange={(e) => setMemCategory(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>

              <p className="section-label" style={{ marginTop: 16 }}>Tag family members</p>
              <div className="member-tags">
                {members.map((mb) => {
                  const col    = avatarColour(mb.name);
                  const tagged = taggedIds.includes(mb.id);
                  return (
                    <button key={mb.id} className={`member-chip ${tagged ? 'selected' : ''}`} onClick={() => toggleTag(mb.id)}>
                      <span className="chip-av" style={{ background: col.bg, color: col.fg }}>{initials(mb.name)}</span>
                      {mb.name.split(' ')[0]}{tagged ? ' ✓' : ''}
                    </button>
                  );
                })}
              </div>

              <button className="btn btn-primary btn-full" style={{ margin: '20px 0' }} onClick={addMemory} disabled={saving}>
                {saving ? 'Saving…' : 'Share with the family circle →'}
              </button>
            </div>
          </>
        )}

        {/* ── MEMORY DETAIL ── */}
        {screen === 'detail' && activeMemory && (
          <>
            <div className="app-bar-sub">
              <button className="btn btn-icon btn-back" onClick={() => setScreen('dashboard')}>←</button>
              <div className="app-title">Memory</div>
            </div>
            <div style={{ padding: '0 20px' }}>
              {(() => {
                const col    = avatarColour(activeMemory.author_name);
                const tagged = taggedMembersFor(activeMemory);
                return (
                  <>
                    <div className="detail-header">
                      <div className="avatar" style={{ background: col.bg, color: col.fg, width: 52, height: 52, fontSize: 20 }}>{initials(activeMemory.author_name)}</div>
                      <div>
                        <div className="detail-title">{activeMemory.title}</div>
                        <div className="detail-meta">Added by {activeMemory.author_name} · {timeAgo(activeMemory.created_at)}</div>
                      </div>
                    </div>
                    <span className="feed-badge" style={{ marginBottom: 16, display: 'inline-block' }}>{activeMemory.category}</span>

                    {activeMemory.voice_url && (
                      <div style={{ background: '#f0fdf8', borderRadius: 12, padding: 14, marginBottom: 16, border: '1px solid #c8e6d0' }}>
                        <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: '#1D9E75' }}>🎙 Voice memory</p>
                        <audio src={activeMemory.voice_url} controls style={{ width: '100%' }} />
                      </div>
                    )}

                    {activeMemory.photo_urls?.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>Photos</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {activeMemory.photo_urls.map((url, i) => <img key={i} src={url} alt="" style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 12, border: '1px solid #eee' }} />)}
                        </div>
                      </div>
                    )}

                    {activeMemory.content && <p className="detail-content">{activeMemory.content}</p>}

                    {tagged.length > 0 && (
                      <><p className="section-label">Tagged family members</p>
                      <div className="tag-row">{tagged.map((mb) => <span key={mb.id} className="tag">👤 {mb.name}</span>)}</div></>
                    )}

                    <div className="detail-actions">
                      <button className="btn" style={{ borderColor: '#1D9E75', color: '#1D9E75' }} onClick={() => setShowShareModal(true)}>↗ Share outside circle</button>
                      <button className="btn" onClick={() => setScreen('add')}>+ Add yours</button>
                    </div>

                    {activeMemory.author_id === user?.id && (
                      <button className="btn btn-danger btn-full" style={{ marginTop: 12 }} onClick={() => deleteMemory(activeMemory.id)}>Delete this memory</button>
                    )}
                  </>
                );
              })()}
            </div>
          </>
        )}

        {/* ── CIRCLE ── */}
        {screen === 'circle' && (
          <>
            <div className="app-bar-sub">
              <div className="app-title">{family?.name}</div>
            </div>

            <div style={{ margin: '0 16px 16px' }}>
              <div className="invite-banner">
                <span style={{ fontSize: 20 }}>🔗</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Invite family members</div>
                  <div style={{ fontSize: 13, color: '#555' }}>Share this link via WhatsApp, SMS, or email</div>
                </div>
              </div>
              <button className="btn btn-primary btn-full" style={{ marginTop: 8 }} onClick={copyInviteLink}>{copyLabel}</button>
            </div>

            <p className="section-label" style={{ padding: '0 20px' }}>{members.length} member{members.length !== 1 ? 's' : ''}</p>
            {members.map((mb) => {
              const col = avatarColour(mb.name);
              return (
                <div className="card row-card" key={mb.id} style={{ margin: '0 16px 10px' }}>
                  <div className="avatar" style={{ background: col.bg, color: col.fg }}>{initials(mb.name)}</div>
                  <div style={{ flex: 1 }}>
                    <div className="card-title">{mb.name}</div>
                    <div className="card-meta">{mb.relationship}</div>
                  </div>
                  <span className="status-chip">{mb.role === 'admin' ? '⭐ Admin' : 'Member'}</span>
                </div>
              );
            })}

            {member?.role === 'admin' && (
              <div style={{ margin: 16, padding: 16, background: '#f0fdf4', borderRadius: 12, border: '1px solid #bbf7d0' }}>
                <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: '#15803d' }}>⭐ You're the family admin</p>
                <p style={{ margin: 0, fontSize: 13, color: '#166534' }}>Share the invite link above to grow your family circle.</p>
              </div>
            )}

            <button style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 16px', padding: '14px 16px', background: '#fff', border: '1px solid #eee', borderRadius: 12, width: 'calc(100% - 32px)', cursor: 'pointer', textAlign: 'left' }} onClick={() => setScreen('about')}>
              <span style={{ fontSize: 20 }}>🌿</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>Why Parivaar</div>
                <div style={{ fontSize: 12, color: '#888' }}>Our story and mission</div>
              </div>
              <span style={{ marginLeft: 'auto', color: '#ccc' }}>›</span>
            </button>

            <button className="btn" style={{ margin: '4px 16px 32px', color: '#999', fontSize: 13 }} onClick={() => { supabase.auth.signOut(); setScreen('story'); setSession(null); }}>Sign out</button>
          </>
        )}

      </div>{/* end scroll-area */}

      {/* Bottom nav */}
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

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  );
}
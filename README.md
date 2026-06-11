# Roots — Family Memories

A private PWA for families to preserve recipes, stories, voice notes and photos together.

---

## Project structure

```
roots-react-supabase/
├── public/
│   ├── index.html          ← PWA meta tags, fonts
│   ├── manifest.json       ← App name, icons, theme
│   ├── sw.js               ← Service worker
│   └── icons/
│       ├── icon-192.png    ← You must provide this
│       └── icon-512.png    ← You must provide this
├── src/
│   ├── App.jsx             ← Entire application
│   ├── main.jsx            ← React entry point
│   ├── supabaseClient.js   ← Supabase client
│   └── styles.css          ← All styles
├── .env.example
├── .gitignore
├── package.json
└── vite.config.js
```

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Environment variables
```bash
cp .env.example .env
```
Fill in your values from **Supabase Dashboard → Project Settings → API**:
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

### 3. Add app icons
Place two PNG files in `public/icons/`:
- `icon-192.png` — 192×192 px
- `icon-512.png` — 512×512 px

Open `generate-icon.html` in a browser to generate these from the 🌿 leaf icon.

### 4. Run locally
```bash
npm run dev
# Opens at http://localhost:5173/parivaar-roots/
```

---

## Supabase — SQL to run

Paste this into **Supabase → SQL Editor → New query**:

```sql
-- Family circles
create table family_circles (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  invite_token text unique not null,
  created_by   uuid references auth.users(id),
  created_at   timestamptz default now()
);

-- Members
create table members (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid references family_circles(id) on delete cascade,
  user_id      uuid references auth.users(id),
  name         text not null,
  relationship text,
  role         text default 'member',
  joined_at    timestamptz default now()
);

-- Memories
create table memories (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid references family_circles(id) on delete cascade,
  author_id   uuid references auth.users(id),
  author_name text,
  title       text not null,
  content     text,
  category    text,
  type        text default 'text',
  voice_url   text,
  photo_urls  text[],
  created_at  timestamptz default now()
);

-- Memory tags (which members are tagged in a memory)
create table memory_tags (
  id        uuid primary key default gen_random_uuid(),
  memory_id uuid references memories(id) on delete cascade,
  member_id uuid references members(id) on delete cascade
);

-- Shared links (share individual memories outside the circle)
create table shared_links (
  id         uuid primary key default gen_random_uuid(),
  memory_id  uuid references memories(id) on delete cascade,
  family_id  uuid references family_circles(id) on delete cascade,
  token      text unique not null,
  expires_at timestamptz,
  views      int default 0,
  created_at timestamptz default now()
);
```

---

## Supabase — Storage RLS

Your `attachments` bucket has two folders: `Photos/` and `voice recording/`.

Run this in SQL Editor:

```sql
-- Family members can upload to attachments
create policy "Family members can upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and exists (
      select 1 from members
      where members.user_id = auth.uid()
      and (storage.objects.name like members.family_id::text || '%')
    )
  );

-- Only members of the same family can read files
create policy "Family members can read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'attachments'
    and exists (
      select 1 from members m1
      join members m2 on m1.family_id = m2.family_id
      where m2.user_id = auth.uid()
      and (storage.objects.name like m1.family_id::text || '%')
    )
  );

-- Anyone can read a shared_link by token (for public share view)
create policy "Public can read shared links"
  on shared_links for select using (true);

-- Family members can create share links
create policy "Family can create share links"
  on shared_links for insert to authenticated
  with check (
    exists (
      select 1 from members
      where members.user_id = auth.uid()
      and members.family_id = shared_links.family_id
    )
  );
```

---

## Deploy to GitHub Pages

```bash
npm run deploy
```

This builds to `dist/` and pushes to the `gh-pages` branch.
Your app will be live at: `https://your-username.github.io/parivaar-roots/`

> Make sure `base: '/parivaar-roots/'` in `vite.config.js` matches your repo name.

---

## How it works for families

1. **Founder** opens the app → creates a circle → becomes admin
2. **Admin** copies the invite link from the Circle tab → sends via WhatsApp or SMS
3. **Family members** open the link → sign in with email (magic link, no password) → enter name and relationship
4. Everyone can add **stories, recipes, voice recordings, and photos**
5. Any memory can be **shared outside the circle** with a time-limited link — only that one memory is visible

---

## Notes

- No passwords — sign-in uses Supabase magic links
- Files in `attachments` storage are only accessible to members of the same family circle
- The app installs to any phone home screen as a PWA
- `base: '/parivaar-roots/'` in vite.config.js must match your GitHub repo name if deploying via gh-pages

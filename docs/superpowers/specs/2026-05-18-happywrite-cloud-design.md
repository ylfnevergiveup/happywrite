# HappyWrite Cloud — Backend Design

**Status**: In Progress | **Date**: 2026-05-18

## Overview

A Node.js REST API server that provides cloud sync and backup for the HappyWrite desktop app. Uses Supabase for managed PostgreSQL + built-in authentication. The desktop client syncs local SQLite data to cloud via this API.

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Runtime | Node.js 20+ | Same language as frontend |
| Framework | Express | Simple REST API, no need for full-stack framework |
| Language | TypeScript | Type sharing with client, Drizzle ORM types |
| Database | PostgreSQL (Supabase) | ACID, free tier, managed |
| Auth | Supabase Auth | Built-in, no custom implementation |
| ORM | Drizzle ORM | Type-safe, already used in HappyWrite client |
| Validation | Zod | Runtime validation + TypeScript types |
| Deploy | Railway / Render / VPS | Simple Node.js hosting |

## Why Supabase Auth Instead of Building Custom Auth

- Registers/logins/email verification/password reset — all built-in
- Returns JWT tokens the API server verifies with Supabase's public key
- Client SDK available for both browser and Node.js
- Free tier: 50,000 monthly active users

The Express API only handles data CRUD/sync. Auth is delegated entirely to Supabase.

## Project Structure

```
happywrite-cloud/
├── src/
│   ├── index.ts              # Express app entry
│   ├── middleware/
│   │   └── auth.ts           # JWT verification via Supabase public key
│   ├── routes/
│   │   ├── novels.ts         # CRUD
│   │   ├── chapters.ts       # CRUD
│   │   ├── characters.ts     # CRUD
│   │   ├── outlines.ts       # CRUD
│   │   ├── worldSettings.ts  # CRUD
│   │   ├── styleSkills.ts    # CRUD
│   │   └── sync.ts           # Bulk push/pull endpoints
│   ├── db/
│   │   ├── index.ts          # Drizzle + pg connection
│   │   └── schema.ts         # Drizzle schema (mirrors client SQLite schema)
│   └── types.ts              # Shared types
├── drizzle.config.ts
├── package.json
└── tsconfig.json
```

## Database Schema (PostgreSQL via Drizzle)

Mirrors the client SQLite schema, plus a `user_id` column on every table for data isolation:

```sql
-- Supabase Auth provides: auth.users (id, email, ...)

CREATE TABLE novels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE volumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  novel_id UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  novel_id UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  volume_id UUID REFERENCES volumes(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  word_count INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft',
  notes TEXT DEFAULT '',
  client_id INTEGER,           -- original SQLite ID for sync mapping
  client_updated_at TEXT,       -- client's updated_at for conflict detection
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Similarly for characters, outline_nodes, world_settings, style_skills, settings
-- All have user_id + client_id + client_updated_at columns
```

Key design decisions:
- Primary keys are UUIDs (not auto-increment) — avoids ID collision across devices
- `client_id` stores the original SQLite integer ID for mapping
- `client_updated_at` is the client-side timestamp for conflict detection
- `user_id` scopes all data to a single user

## API Endpoints

### Auth (handled by Supabase client SDK, no custom endpoints needed)

Client uses `@supabase/supabase-js` directly for signup/login. The Express API only verifies the resulting JWT.

### Sync

```
POST /api/sync/push
Headers: Authorization: Bearer <jwt>
Body: {
  table: "chapters",
  rows: [{ client_id: 1, title: "...", content: "...", client_updated_at: "..." }]
}
Response: { ok: true, server_ids: { 1: "uuid-xxx" } }

POST /api/sync/pull
Headers: Authorization: Bearer <jwt>
Body: { table: "chapters", last_sync_at: "2026-05-18T00:00:00Z" }
Response: {
  rows: [...],
  server_time: "2026-05-18T12:00:00Z"
}
```

### CRUD (backup/restore)

```
GET    /api/novels          # List user's novels
POST   /api/novels          # Create novel
GET    /api/novels/:id      # Get novel with volumes/chapters
PUT    /api/novels/:id      # Update
DELETE /api/novels/:id      # Delete

GET    /api/novels/:novelId/chapters            # List chapters
POST   /api/novels/:novelId/chapters            # Create
PUT    /api/novels/:novelId/chapters/:id        # Update
DELETE /api/novels/:novelId/chapters/:id        # Delete

# Similar for characters, outlines, worldSettings, styleSkills
```

## Auth Flow

```
Desktop App                          Supabase Auth                  Express API
    │                                      │                            │
    │── signUp(email, password) ──────────▶│                            │
    │◀── JWT access_token ─────────────────│                            │
    │                                      │                            │
    │── GET /api/novels ──────────────────────────────────────────────▶│
    │   (Authorization: Bearer <jwt>)      │                            │
    │                                      │                            │── verify JWT
    │                                      │                            │   (Supabase public key)
    │                                      │                            │── query PG
    │◀── 200 [{ id, title, ... }] ─────────────────────────────────────│
```

## Conflict Resolution (for sync engine)

When pushing data:
1. Compare `client_updated_at` with server's `updated_at`
2. **Client wins if newer** — update server record
3. **Server wins if newer** — return server version to client in response
4. **Same timestamp** — keep server version, no-op

Simple last-write-wins. Good enough for personal writing app.

## Deployment

Option: **Railway** (simplest Node.js deploy, auto HTTPS, ~$5/mo starter)

```
railway up
```

Or **Render** free tier (slower cold start but free).

Supabase runs separately (already managed).

## Scope Boundary — What B1 Does NOT Include

- ❌ No custom auth implementation (Supabase handles it)
- ❌ No file storage (novels are text, DB is enough)
- ❌ No real-time sync (poll-based pull is simpler for v1)
- ❌ No multi-device conflict resolution beyond last-write-wins
- ❌ No sharing/collaboration features

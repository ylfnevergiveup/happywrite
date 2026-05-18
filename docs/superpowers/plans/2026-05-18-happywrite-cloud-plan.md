# HappyWrite Cloud — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Node.js REST API server with Express + Drizzle ORM + Supabase PostgreSQL that provides cloud sync and backup endpoints for the HappyWrite desktop app.

**Architecture:** Express API with JWT auth middleware (verifying Supabase-issued tokens). All tables include `user_id` for isolation and `client_id`/`client_updated_at` for sync ID mapping and conflict detection. Sync uses push/pull endpoints with last-write-wins conflict resolution.

**Tech Stack:** Node.js 20, Express, TypeScript, Drizzle ORM, Supabase (PostgreSQL + Auth), Zod

---

## Prerequisites

Before any code, create a Supabase project at https://supabase.com:
1. Create new project → get `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
2. Get the JWT signing secret from Supabase dashboard → Settings → API → JWT Secret
3. Save these as environment variables

---

## File Structure

```
happywrite-cloud/
├── .env
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── drizzle.config.ts
├── src/
│   ├── index.ts              # Express app entry, register routes
│   ├── config.ts             # env vars loading
│   ├── middleware/
│   │   └── auth.ts           # Supabase JWT verification middleware
│   ├── db/
│   │   ├── index.ts          # Drizzle client init
│   │   └── schema.ts         # All table definitions
│   ├── routes/
│   │   ├── novels.ts
│   │   ├── chapters.ts
│   │   ├── characters.ts
│   │   ├── outlines.ts
│   │   ├── worldSettings.ts
│   │   ├── styleSkills.ts
│   │   ├── settings.ts
│   │   └── sync.ts
│   └── types.ts              # Shared request/response types
└── drizzle/
    └── (migrations)          # Auto-generated
```

---

### Task 1: Scaffold project

**Files:**
- Create: `package.json`, `tsconfig.json`, `.gitignore`, `.env.example`, `src/index.ts`, `src/config.ts`

This task creates the new project directory and installs dependencies.

- [ ] **Step 1: Create project directory and initialize**

```bash
mkdir -p /Users/yelifeng/Documents/trae_projects/CC-project/happywrite-cloud/src
cd /Users/yelifeng/Documents/trae_projects/CC-project/happywrite-cloud
git init
```

- [ ] **Step 2: Create package.json**

```json
{
  "name": "happywrite-cloud",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate"
  },
  "dependencies": {
    "drizzle-orm": "^0.39.0",
    "express": "^4.21.0",
    "jsonwebtoken": "^9.0.0",
    "jwks-rsa": "^3.1.0",
    "postgres": "^3.4.0",
    "zod": "^3.23.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/jsonwebtoken": "^9.0.0",
    "@types/cors": "^2.8.0",
    "@types/node": "^20.0.0",
    "drizzle-kit": "^0.30.0",
    "tsx": "^4.0.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create .env.example and .gitignore**

`.env.example`:
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_JWT_SECRET=your-jwt-secret
DATABASE_URL=postgresql://postgres:...@db.xxxxx.supabase.co:5432/postgres
PORT=3000
```

`.gitignore`:
```
node_modules
dist
.env
```

- [ ] **Step 5: Create src/config.ts**

```typescript
import 'dotenv/config'

export const config = {
  port: parseInt(process.env.PORT || '3000'),
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  supabaseJwtSecret: process.env.SUPABASE_JWT_SECRET!,
  databaseUrl: process.env.DATABASE_URL!,
}
```

- [ ] **Step 6: Install dependencies**

```bash
cd /Users/yelifeng/Documents/trae_projects/CC-project/happywrite-cloud
npm install
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold happywrite-cloud project"
```

---

### Task 2: Set up database schema and connection

**Files:**
- Create: `src/db/index.ts`, `src/db/schema.ts`, `drizzle.config.ts`

- [ ] **Step 1: Create drizzle.config.ts**

```typescript
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

- [ ] **Step 2: Create src/db/schema.ts**

```typescript
import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core'

export const novels = pgTable('novels', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(),
  clientId: integer('client_id'),
  title: text('title').notNull(),
  description: text('description').default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
  clientUpdatedAt: text('client_updated_at'),
})

export const volumes = pgTable('volumes', {
  id: uuid('id').defaultRandom().primaryKey(),
  novelId: uuid('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  clientId: integer('client_id'),
  title: text('title').notNull(),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const chapters = pgTable('chapters', {
  id: uuid('id').defaultRandom().primaryKey(),
  novelId: uuid('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  volumeId: uuid('volume_id').references(() => volumes.id, { onDelete: 'set null' }),
  userId: uuid('user_id').notNull(),
  clientId: integer('client_id'),
  title: text('title').notNull(),
  content: text('content').default(''),
  wordCount: integer('word_count').default(0),
  sortOrder: integer('sort_order').default(0),
  status: text('status').default('draft'),
  notes: text('notes').default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
  clientUpdatedAt: text('client_updated_at'),
})

export const characters = pgTable('characters', {
  id: uuid('id').defaultRandom().primaryKey(),
  novelId: uuid('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  clientId: integer('client_id'),
  name: text('name').notNull(),
  aliases: text('aliases').default(''),
  role: text('role').default(''),
  description: text('description').default(''),
  attributes: text('attributes').default('{}'),
  relationships: text('relationships').default('[]'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
  clientUpdatedAt: text('client_updated_at'),
})

export const outlineNodes = pgTable('outline_nodes', {
  id: uuid('id').defaultRandom().primaryKey(),
  novelId: uuid('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  parentId: uuid('parent_id'),
  userId: uuid('user_id').notNull(),
  clientId: integer('client_id'),
  title: text('title').notNull(),
  description: text('description').default(''),
  type: text('type').default('scene'),
  sortOrder: integer('sort_order').default(0),
  chapterId: integer('chapter_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
  clientUpdatedAt: text('client_updated_at'),
})

export const worldSettings = pgTable('world_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  novelId: uuid('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  clientId: integer('client_id'),
  category: text('category').notNull(),
  title: text('title').notNull(),
  content: text('content').default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
  clientUpdatedAt: text('client_updated_at'),
})

export const styleSkills = pgTable('style_skills', {
  id: uuid('id').defaultRandom().primaryKey(),
  novelId: uuid('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  clientId: integer('client_id'),
  name: text('name').notNull(),
  sourceType: text('source_type').notNull().default('paste'),
  sourceText: text('source_text').default(''),
  styleProfile: text('style_profile').default(''),
  isDefault: integer('is_default').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  clientUpdatedAt: text('client_updated_at'),
})

export const settings = pgTable('settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(),
  key: text('key').notNull(),
  value: text('value').default('{}'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
})
```

- [ ] **Step 3: Create src/db/index.ts**

```typescript
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { config } from '../config'
import * as schema from './schema'

const client = postgres(config.databaseUrl)
export const db = drizzle(client, { schema })
```

- [ ] **Step 4: Verify TypeScript compilation**

```bash
cd /Users/yelifeng/Documents/trae_projects/CC-project/happywrite-cloud && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add database schema and drizzle config"
```

---

### Task 3: Create auth middleware

**Files:**
- Create: `src/middleware/auth.ts`

- [ ] **Step 1: Create the auth middleware**

```typescript
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config'

// Extend Express Request to include userId
declare global {
  namespace Express {
    interface Request {
      userId?: string
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization header' })
    return
  }

  const token = authHeader.slice(7)

  try {
    // Verify Supabase-issued JWT using the JWT secret
    const payload = jwt.verify(token, config.supabaseJwtSecret, {
      algorithms: ['HS256'],
      issuer: config.supabaseUrl + '/auth/v1',
    }) as { sub: string }

    req.userId = payload.sub
    next()
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}
```

- [ ] **Step 2: Verify TypeScript compilation**

```bash
cd /Users/yelifeng/Documents/trae_projects/CC-project/happywrite-cloud && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add Supabase JWT auth middleware"
```

---

### Task 4: Create Express app entry point and route stubs

**Files:**
- Create: `src/index.ts`
- Create: `src/routes/novels.ts`, `chapters.ts`, `characters.ts`, `outlines.ts`, `worldSettings.ts`, `styleSkills.ts`, `settings.ts`, `sync.ts`

- [ ] **Step 1: Create src/index.ts**

```typescript
import express from 'express'
import cors from 'cors'
import { config } from './config'
import { authMiddleware } from './middleware/auth'
import { novelRoutes } from './routes/novels'
import { chapterRoutes } from './routes/chapters'
import { characterRoutes } from './routes/characters'
import { outlineRoutes } from './routes/outlines'
import { worldSettingRoutes } from './routes/worldSettings'
import { styleSkillRoutes } from './routes/styleSkills'
import { settingRoutes } from './routes/settings'
import { syncRoutes } from './routes/sync'

const app = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))

// All routes require auth
app.use('/api', authMiddleware)

app.use('/api/novels', novelRoutes)
app.use('/api/chapters', chapterRoutes)
app.use('/api/characters', characterRoutes)
app.use('/api/outlines', outlineRoutes)
app.use('/api/world-settings', worldSettingRoutes)
app.use('/api/style-skills', styleSkillRoutes)
app.use('/api/settings', settingRoutes)
app.use('/api/sync', syncRoutes)

// Health check (no auth)
app.get('/health', (_req, res) => { res.json({ ok: true }) })

app.listen(config.port, () => {
  console.log(`HappyWrite Cloud running on port ${config.port}`)
})
```

- [ ] **Step 2: Create each route file as a stub**

Each route file follows this pattern (example for `src/routes/novels.ts`):

```typescript
import { Router } from 'express'
import { db } from '../db'
import { novels } from '../db/schema'
import { eq, and } from 'drizzle-orm'

export const novelRoutes = Router()

// GET /api/novels — list user's novels
novelRoutes.get('/', async (req, res) => {
  try {
    const rows = await db.select().from(novels)
      .where(eq(novels.userId, req.userId!))
      .orderBy(novels.updatedAt)
    res.json(rows)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/novels — create novel
novelRoutes.post('/', async (req, res) => {
  try {
    const { title, description, client_id } = req.body
    const [row] = await db.insert(novels).values({
      userId: req.userId!,
      clientId: client_id,
      title,
      description: description || '',
    }).returning()
    res.status(201).json(row)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/novels/:id
novelRoutes.get('/:id', async (req, res) => {
  try {
    const [row] = await db.select().from(novels)
      .where(and(eq(novels.id, req.params.id), eq(novels.userId, req.userId!)))
    if (!row) { res.status(404).json({ error: 'Not found' }); return }
    res.json(row)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/novels/:id
novelRoutes.put('/:id', async (req, res) => {
  try {
    const { title, description } = req.body
    const [row] = await db.update(novels)
      .set({ title, description, updatedAt: new Date() })
      .where(and(eq(novels.id, req.params.id), eq(novels.userId, req.userId!)))
      .returning()
    if (!row) { res.status(404).json({ error: 'Not found' }); return }
    res.json(row)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/novels/:id
novelRoutes.delete('/:id', async (req, res) => {
  try {
    await db.delete(novels)
      .where(and(eq(novels.id, req.params.id), eq(novels.userId, req.userId!)))
    res.json({ ok: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})
```

Create the same pattern for: chapters.ts, characters.ts, outlines.ts, worldSettings.ts, styleSkills.ts, settings.ts. Each follows the same CRUD pattern with `userId` scoping and `clientId` passthrough.

- [ ] **Step 3: Create sync routes (src/routes/sync.ts)**

```typescript
import { Router } from 'express'
import { db } from '../db'
import * as schema from '../db/schema'
import { eq, and, gt } from 'drizzle-orm'

export const syncRoutes = Router()

// Map table names to Drizzle table objects
const tables: Record<string, any> = {
  novels: schema.novels,
  chapters: schema.chapters,
  characters: schema.characters,
  outline_nodes: schema.outlineNodes,
  world_settings: schema.worldSettings,
  style_skills: schema.styleSkills,
  settings: schema.settings,
}

// POST /api/sync/push — upload local changes
syncRoutes.post('/push', async (req, res) => {
  try {
    const { table, rows } = req.body
    const tbl = tables[table]
    if (!tbl) { res.status(400).json({ error: 'Invalid table' }); return }

    const results: Record<number, string> = {}

    for (const row of rows) {
      const { client_id, client_updated_at, ...data } = row

      if (row.id && row.id.length === 36) {
        // Has server UUID — update existing
        await db.update(tbl)
          .set({ ...data, updatedAt: new Date() })
          .where(and(eq(tbl.id, row.id), eq(tbl.userId, req.userId!)))
        results[client_id] = row.id
      } else {
        // No server ID — insert new
        const [inserted] = await db.insert(tbl)
          .values({ ...data, userId: req.userId!, clientId: client_id, clientUpdatedAt: client_updated_at })
          .returning()
        if (inserted) results[client_id] = inserted.id
      }
    }

    res.json({ ok: true, server_ids: results })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/sync/pull — download remote changes
syncRoutes.post('/pull', async (req, res) => {
  try {
    const { table, last_sync_at } = req.body
    const tbl = tables[table]
    if (!tbl) { res.status(400).json({ error: 'Invalid table' }); return }

    const rows = await db.select().from(tbl)
      .where(
        last_sync_at
          ? and(eq(tbl.userId, req.userId!), gt(tbl.updatedAt, new Date(last_sync_at)))
          : eq(tbl.userId, req.userId!)
      )
      .orderBy(tbl.updatedAt)

    res.json({ rows, server_time: new Date().toISOString() })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/sync/status — quick check
syncRoutes.get('/status', async (_req, res) => {
  res.json({ status: 'ok', server_time: new Date().toISOString() })
})
```

- [ ] **Step 4: Verify TypeScript compilation**

```bash
cd /Users/yelifeng/Documents/trae_projects/CC-project/happywrite-cloud && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add Express app entry and all API route files"
```

---

### Task 5: Run database migration and smoke test

- [ ] **Step 1: Generate and run migration**

```bash
cd /Users/yelifeng/Documents/trae_projects/CC-project/happywrite-cloud
npx drizzle-kit generate
npx drizzle-kit migrate
```

- [ ] **Step 2: Start dev server**

```bash
npm run dev
```

- [ ] **Step 3: Smoke test with curl**

```bash
# Health check
curl http://localhost:3000/health
# Expected: {"ok":true}

# Auth check (no token)
curl http://localhost:3000/api/novels
# Expected: {"error":"Missing authorization header"}

# With valid Supabase token (get from Supabase client after signup):
# curl -H "Authorization: Bearer <token>" http://localhost:3000/api/novels
# Expected: []
```

- [ ] **Step 4: Commit any fixes**

```bash
git add -A && git commit -m "fix: migration and smoke test corrections"
```

---

### Task 6: Set up deployment

- [ ] **Step 1: Add start script for production**

In `package.json`, ensure the `start` script exists: `"start": "node dist/index.js"`

- [ ] **Step 2: Create Railway config (railway.json)**

```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install && npm run build && npx drizzle-kit migrate"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/health"
  }
}
```

- [ ] **Step 3: Deploy to Railway**

```bash
# Install Railway CLI if not installed:
# npm i -g @railway/cli

cd /Users/yelifeng/Documents/trae_projects/CC-project/happywrite-cloud
railway login
railway init
railway up
```

Set environment variables in Railway dashboard: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `DATABASE_URL`.

- [ ] **Step 4: Test deployed API**

```bash
curl https://<your-app>.up.railway.app/health
# Expected: {"ok":true}
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: add deployment config"
```

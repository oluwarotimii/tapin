# TapIn

Next.js (App Router) + Tailwind CSS v4 + PostgreSQL (Prisma) tap-and-go RFID attendance system. Runs as a full-stack app with a scoped-API-key REST API for external LMS integrations.

## Development Server

Run it yourself: `pnpm dev` (binds `0.0.0.0:8443`). Changes to source files hot-reload immediately.

- Preview URL: the user accesses the running app through the preview panel
- If the port is busy (`EADDRINUSE`), a previous instance is still running — kill it first: `fuser -k 8443/tcp`

## Database (PostgreSQL)

The app expects a Postgres instance with a `tapin` database. Reproduce it with Docker:

```
docker run -d --name tapin-postgres \
  -e POSTGRES_USER=tapin -e POSTGRES_PASSWORD=tapin_dev_pw -e POSTGRES_DB=tapin \
  -p 5434:5432 postgres:16-alpine
```

Connection string lives in `.env` (`DATABASE_URL`). Apply schema: `pnpm db:migrate`. Seed the roster: `pnpm db:seed` — reads `prisma/data/students.csv`, `schedules.csv`, and optional `attendance.csv`, resets students/schedules/attendance/API keys, and keeps the admin account (re-runnable).

## Project Structure

This is the canonical project structure. Start with task-relevant files below. Only follow imports or inspect other files when required, when a documented path is missing, or when the repository contradicts this guide.

- `src/app/` - App Router pages (`/`, `/login`, `/setup`, `/terminal`, `/admin/*`) and API routes
- `src/proxy.ts` - Next middleware (matcher `/admin/:path*`) that gates the admin pages behind a valid `tapin_session` JWT cookie
- `src/app/api/v1/` - Public REST API, authenticated with `Authorization: Bearer tp_…` API keys or the admin session
- `src/app/api/keys/` - API key management (admin session only)
- `src/components/` - Client UI components (Terminal, admin views, Login/Setup, ApiKeys)
- `src/store.ts` - Client-side data cache mirroring the old sync `db.*` API; optimistic mutations backed by the API
- `src/reader.ts` - Client reader seam: real HID card taps (`submitCardTap`) and fingerprint-bridge-resolved taps (`submitFingerprintTap`), both posting to `POST /api/v1/taps`
- `src/lib/fingerprintBridge.ts` - Real HTTP client for the local fingerprint companion bridge (`docs/fingerprint-integration.md`); no bridge is deployed yet so calls genuinely report "not connected" until one exists
- `src/lib/` - Shared types, API fetch helpers, session auth (`session.ts`), API key crypto (`apiKey.ts`), validation, CSV parser
- `src/server/` - Server-only domain logic: `domain.ts` (tap rules), `students.ts`, `attendance.ts`, `guard.ts` (auth/scopes)
- `prisma/schema.prisma` - Data model: `User`, `ApiKey`, `Student`, `ScheduleDay`, `AttendanceRecord`, `ActiveSession`
- `package.json` - Scripts (dev/build/db:migrate/db:seed) and dependencies

## Dependencies

- Runtime: Next.js 16 (App Router), React 19
- Data: PostgreSQL + Prisma ORM
- Styling: Tailwind CSS v4 via `@tailwindcss/postcss` (`src/app/globals.css`)
- Auth: custom jose JWT sessions (httpOnly cookie) + bcryptjs password hashes
- Validation: zod; Formatting: prettier

## API key auth

External apps authenticate with a scoped key: `Authorization: Bearer tp_…`. Keys are created/revoked in **Admin → API Keys**. Scopes (`students_read`, `students_write`, `schedules_*`, `attendance_*`, `taps_write`, `cards_write`, `fingerprints_write`) gate each `/api/v1` endpoint; a missing scope returns `403`. The web session counts as full admin access.

## Public tap kiosk

`/terminal` (and the `/` home redirect) is a **public, login-free kiosk** — it shows no admin buttons; admin is reached only via `/admin`, which is blocked by `src/proxy.ts` (Next middleware, matcher `/admin/:path*`) when the session cookie is missing/expired and redirects to `/login` (password required). To make the kiosk work, `authorizeRequest` accepts `{ allowPublic: true }`, granting anonymous callers `auth.type = "public"` (invalid credentials still rejected). Public routes: `GET /api/v1/students` (strips `cardId`/`schedule`), `GET /api/v1/schedule`, `GET /api/v1/sessions` (strips `cardId`), `POST /api/v1/taps`. The store's `loadAll()` tolerates per-endpoint 401s so the kiosk loads its public data while attendance stays gated. Note: server-component `redirect()` does not emit real HTTP redirects in this Next setup — page-level auth must rely on the proxy, not layout redirects.

## Styling

Tailwind CSS v4 via the `@tailwindcss/postcss` plugin in `postcss.config.mjs`. `src/app/globals.css` imports Tailwind and holds the theme tokens (`--color-*`, `--font-*`). Fonts are loaded with `next/font` in `src/app/layout.tsx`. Use Tailwind utilities in JSX; global CSS/theme lives in `globals.css`.

## Code quality

- Use double quotes for strings containing apostrophes (`"We're here to help"`), or escape them in single-quoted strings. An unescaped apostrophe in a single-quoted string breaks the build.
- Ensure JSX tags are closed and braces are balanced.
- Export components as default exports.
- Do **not** run `npm run format` with oxfmt — the formatter is `prettier`. Use `npx prettier --write .` if needed.
- After schema changes: `pnpm db:migrate` then `pnpm db:generate`.
- Verify with `npx tsc --noEmit` and `pnpm build` before finishing a task.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

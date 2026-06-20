# Sistema Integral Conceptos y Diseños

Web app mobile-first para gestión financiera de obras de arquitectura y remodelación.
Slug: `conceptos-disenos` | GitHub: `conceptosydisenos/conceptos-disenos`

## Commands

- `pnpm dev` — Dev server on localhost:3000
- `pnpm build` — Production build
- `pnpm lint` — ESLint
- `pnpm test` — Vitest (financial calculations — run before every commit)
- `pnpm test:e2e` — Playwright (critical flows)
- `pnpm db:generate` — Generate Drizzle migration
- `pnpm db:migrate` — Apply migrations to Neon
- `pnpm db:push` — Quick push (dev only — never use in production)
- `pnpm db:studio` — Drizzle Studio (visual DB browser)

## Tech Stack

Next.js 14 (App Router) + TypeScript strict + Tailwind CSS + shadcn/ui +
Drizzle ORM + Neon PostgreSQL + Clerk Auth (Google OAuth + email) +
Vercel Blob + Gemini Flash 2.0 + Claude API (Fase 3)

## Architecture

### Directory Structure

- `src/app/(auth)/` — Clerk sign-in and sign-up pages
- `src/app/(dashboard)/` — All protected pages under sidebar layout
- `src/app/api/` — API routes: projects, invoices, OCR, uploads, cuts, webhook
- `src/components/ui/` — shadcn/ui primitives (do not modify directly)
- `src/components/facturas/` — CameraCapture, OCRReview, AllocationForm
- `src/components/cortes/` — CorteForm, ActivityProgressSlider, CorteSummary
- `src/components/dashboard/` — KPICard, UnassignedInvoicesAlert, charts
- `src/lib/db/schema.ts` — Complete Drizzle schema (single source of truth)
- `src/lib/calculations.ts` — ALL financial logic lives here (with tests)
- `src/lib/gemini.ts` — Gemini OCR client
- `src/lib/auth.ts` — getCurrentUser(), requireRole(), requireAuth()
- `src/types/index.ts` — Shared types inferred from Drizzle schema

### Data Flow

Server Component → Drizzle query directly (no intermediate API call)
Client form → Server Action or API route → Drizzle → Neon

Invoice capture flow:
CameraCapture → /api/uploads → Vercel Blob (URL)
→ /api/facturas/ocr → Gemini Flash (extracted data)
→ OCRReview (human confirms/edits) → /api/facturas/[id]/allocate → DB

### Key Patterns

- Server Components by default. Add `"use client"` only for interactivity
- ALL financial formulas in `src/lib/calculations.ts` — never inline
- Auth via `requireRole(['admin'])` or `requireAuth()` at the top of every API route
- Google OAuth is configured in Clerk Dashboard — no code changes needed
- `revalidatePath()` after every mutation, `revalidate: 300` on dashboard

## Code Organization Rules

1. **One component per file.** Max 300 lines. Extract sub-components if longer.
2. **Path alias `@/`** for all imports from `src/`. No relative `../` paths.
3. **TypeScript strict.** No `any`. Types inferred from `InferSelectModel<typeof table>`.
4. **Financial numbers**: always `NUMERIC(15,2)` in DB; use `parseFloat()` only at display time.
5. **tabular-nums on every monetary display**: apply `.amount` or `.tabular-nums` CSS class.
6. **Mobile-first**: build for 390px first, then scale up. David uses this in the field.
7. **UI changes require both viewports**: every interface fix must be verified at 390px (mobile) AND 1280px+ (desktop) before push. Never ship a UI change that only works on one viewport.

## Design System

### Colors (CSS variables in globals.css)

- `--primary: 214 52% 25%` → Navy #1e3a5f (sidebar, primary buttons)
- `--accent: 38 92% 50%` → Amber #f59e0b (badges, alerts, overdue indicators)
- `--background: 210 40% 98%` → Slate-50 #f8fafc
- `--destructive: 0 84% 60%` → Red #ef4444 (overdue badge, errors)
- `--success: 142 71% 45%` → Green #22c55e (positive margins, paid status)

### Typography

- Font: Inter (loaded via next/font/google — no CDN needed)
- KPI numbers: `text-3xl font-bold tabular-nums` → use `.kpi-value` class
- Table money: `text-right tabular-nums` → use `.amount` class
- Positive amounts: `.amount-positive` | Negative: `.amount-negative`

### Style

- Border radius: 8px (rounded-lg default)
- Cards: `bg-card rounded-xl border border-border shadow-sm p-6` → use `.section-card`
- No decorative animations. Function over form.
- Sidebar: navy background (`sidebar-bg` utility), 240px desktop, bottom nav mobile

## Critical Business Rules (enforce in code)

1. **Approved work cuts are IMMUTABLE.** Reject PUT on `work_cuts` where `status = 'approved'`.
2. **OCR never auto-confirms.** `extractInvoiceData()` always returns `requires_review: true`.
3. **Invoices >48h without allocation → red KPI card on dashboard (Admin only).**
4. **One invoice can be split across multiple projects** via `invoice_allocations` table.
5. **Advance amortization = advance_percentage × total_executed per cut.** See `calculations.ts`.
6. **All audit-sensitive operations** (approve cut, register advance, allocate invoice) → write to `audit_logs`.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon **pooler** connection string |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk public key |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `CLERK_WEBHOOK_SECRET` | Webhook at /api/webhooks/clerk (user sync) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob (invoice images) |
| `GEMINI_API_KEY` | Google AI Studio API key (NOT a service account) |
| `ANTHROPIC_API_KEY` | Claude API [Fase 3 only] |

## Non-Negotiable Rules

1. TypeScript strict mode. No `any`, no `as unknown as`.
2. Use Neon pooler URL in production — never the direct connection string.
3. Never commit `.env.local`. Never commit Google service account JSON files.
4. Every financial formula in `calculations.ts` must have a Vitest unit test.
5. Every API route that mutates data must call `requireAuth()` or `requireRole()` first.

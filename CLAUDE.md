# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. It serves as the long-term architecture guide for the project. Read it fully before making recommendations or changes.

---

## Product Vision

This is **not** a website template generator. The goal is to build the **world's easiest AI web design platform**.

The user experience target: every interaction should feel like talking to a professional web designer, not filling out a form. The user describes what they want in plain language. The AI interprets intent, makes design decisions, and produces something that feels unique and professionally crafted — not generic.

Every generated website must feel visually distinct and appropriate to its business type. A luxury car detailing brand and a children's tutoring business should produce dramatically different designs — different palettes, typography choices, layout energy, and copy tone — without the user having to specify any of that.

This distinction matters for every architectural decision. Features, data models, and AI prompts should be evaluated against this standard: does this make the experience feel more like a professional designer, or more like a form?

---

## Architectural Principles

These rules apply to all code changes in this project. Follow them in order of priority.

1. **Never break existing functionality.** If a change might affect a working feature, test the affected path before committing.
2. **Analyze the architecture before making major changes.** Read relevant files, understand data flow, and explain the plan before editing multiple files.
3. **Prefer scalable solutions over quick fixes.** This is a long-term platform, not a prototype being thrown away. Shortcuts create compounding debt.
4. **Keep code modular.** Logic that is reused across pages belongs in `lib/`. API routes should be thin — validation, one AI or DB call, response. Business logic lives in shared modules.
5. **Maintain backwards compatibility whenever possible.** Stored siteData in Supabase must continue to load correctly after any data model change. The `normalizeSiteData()` function is the migration layer — use it.
6. **Explain your implementation plan before editing multiple files.** State which files will change, why, and in what order.

---

## Running the App

This project has **no build step**. The frontend is plain HTML/CSS/JS. API routes require the Vercel runtime — run locally with:

```
npx vercel dev
```

The app is then available at `http://localhost:3000`. Without `vercel dev`, all `/api/` routes return 404.

For a published-site viewer without Supabase, use the `?test=local` param to load from localStorage:
```
/site.html?id=site-test123&test=local
```

---

## Required Environment Variables

Set these in `.env.local` (or Vercel project settings):
- `OPENAI_API_KEY` — used by all `/api/generate*` and `/api/modify` routes
- `SUPABASE_URL` — Supabase project REST URL
- `SUPABASE_ANON_KEY` — Supabase anon key

---

## Current Architecture

### Frontend (no framework)
- `index.html` — the full editor UI. All builder state lives in a `siteData` object on the page. Draft state is persisted to `localStorage` (`siteData` key). Version history (max 5) is stored under `siteHistory`.
- `site.html` — the public viewer for launched/shared sites. Fetches site data from `GET /api/get-published-site?id=<uuid>` and renders using `SiteSchema`.

### Shared libraries (loaded as script tags, both pages)
- `lib/site-schema.js` — the central data model. Exposes `window.SiteSchema`. Handles:
  - `normalizeSiteData(raw)` — coerces any partial siteData into the canonical schema (version 2). This is the migration layer for all data model changes.
  - `renderHomeSections(container, data, {mode})` — renders home sections into a DOM container; `mode` is `"preview"` or `"launched"`
  - `applyThemeStyles(root, theme, layout)` — computes and applies all CSS variables to a root element
  - `buildThemeCssVariables(theme, layout)` — returns the full `--site-*` CSS variable map
- `lib/editor-actions.js` — exposes `window.EditorActions`. Provides a structured action system (`applyActions(siteData, actions[])`) for patching site data via typed action objects (`update_section`, `add_component`, `move_component`, `update_theme`, etc.). **This is the intended canonical mutation path for AI responses.** Currently, `api/modify.js` bypasses it and applies raw JSON patches instead — that is a known gap, not the intended design.
- `lib/site-theme.css` — CSS variable-driven theme system. All visual styling references `--site-*` variables set by `applyThemeStyles`.

### API routes (`/api/*.js`, Vercel serverless functions)
| Route | Purpose |
|---|---|
| `POST /api/generate` | Calls OpenAI (`gpt-5.4`, `/v1/responses`) to generate full siteData JSON from a prompt |
| `POST /api/modify` | Calls OpenAI to return a partial patch for a specific section (hero, services, features, about, contact, all, or a custom page slug) |
| `POST /api/generate-image` | Calls OpenAI to generate a hero image, stores in Vercel Blob, returns URL |
| `POST /api/generate-logo` | Calls OpenAI to suggest logo options (returns array of `{url, name}`) |
| `POST /api/publish-site` | Saves a read-only snapshot to Supabase `published_sites` table, returns `{id}` for share URL |
| `GET /api/get-published-site` | Fetches a published snapshot by UUID from Supabase |
| `POST /api/save-site` | Saves a draft project to Supabase `websites` table (per `userId`) |
| `POST /api/update-site` | Updates an existing draft project by `id` |
| `GET /api/load-sites` | Lists draft projects for a `userId` |
| `POST /api/delete-site` | Deletes a draft project by `id` |

### Data model (`siteData`, schema version 2)
```
{
  schemaVersion: 2,
  theme: { backgroundColor, textColor, primaryColor, secondaryColor, accent, heroBackground, navBackground, navText, style, fontStyle, buttonStyle, cardStyle, heroLayout, spacing, borderRadius },
  layout: { heroAlign, sectionAlign, heroImagePosition, navAlign, sectionGap, mobileHeroStack },
  heroTitle, heroSubtitle, about, contact, logoUrl, heroImageUrl,
  services: [{title, description}],
  features: [{title, description}],
  pages: [{slug, title, fileName, components:[]}],
  homeSections: [{id, type, visible, title?, ...}]
}
```

**Home section types** (built-in): `hero`, `services`, `features`, `about`, `contact`  
**Component types** (for custom pages and extra home sections): `text`, `pricing`, `button`, `testimonial`, `faq`

### Supabase tables
- `websites` — mutable user draft projects (`user_id`, `title`, `site_data jsonb`, timestamps)
- `published_sites` — **write-once** public read-only snapshots (`id uuid`, `title`, `site_data jsonb`, `created_at`). Requires running `supabase/migrations/001_published_sites.sql` once in the Supabase SQL Editor.

**Important:** Published sites are point-in-time snapshots. A share link (`/site.html?id=<uuid>`) must remain valid forever. Relaunching a site creates a new record with a new UUID — it does not update the existing one. Never build logic that mutates a `published_sites` row after creation.

### Theme engine
`applyThemeStyles` detects whether a theme is "premium" (dark background + gold-like accent or luxury style) and applies a richer visual treatment: gradient backgrounds, gold-tinted borders/shadows, and backdrop-blur nav. All computed values flow into `--site-*` CSS variables consumed by `site-theme.css`. The `isDarkColor` and `isGoldLikeColor` helpers drive this detection.

Visual uniqueness is a first-class product requirement. The theme engine should be extended toward more layout and style variety — not simplified or replaced with a template picker. New visual modes (e.g., soft pastel, neon, editorial, minimal) should be added as detection branches inside the existing engine.

---

## Future Roadmap

Features are grouped by the architectural layer they affect. Earlier layers must be stable before building features that depend on them.

### Layer 1 — Foundation (must come first)
These are prerequisites for almost everything else.

- **Authentication** — Replace the `"demo-user"` placeholder with real user sessions. Supabase Auth is the natural fit given the existing Supabase dependency. RLS policies on `websites` and `published_sites` need to be tightened from `using (true)` to `using (auth.uid() = user_id)`. All API routes need to read a session token instead of a hardcoded userId.
- **Wire `EditorActions` to the AI modify path** — Have `api/modify.js` prompt the AI to return typed action objects and run them through `EditorActions.applyActions()`. This enables multi-step, validated, position-aware mutations that the current raw-patch approach cannot support.

### Layer 2 — Data Model Expansion
Each of these requires a schema version bump and a migration branch in `normalizeSiteData()`.

- **SEO fields** — Add `meta: { title, description, ogImage }` per page inside the `pages` array. Required before custom domains are meaningful.
- **Blog** — A `posts` collection on siteData with slugs, publish dates, body content, and tags. This is a separate collection from `pages` and needs its own render path in `site.html`.
- **Ecommerce** — A `products` collection with name, price, images, variants, and stock. Requires a cart state layer and a payment provider integration (Stripe is the obvious choice). The `pricing` component type is not sufficient for this.
- **Booking systems** — A `bookingConfig` object with service types, availability windows, and time slot rules. Requires a scheduling state layer and likely a third-party integration (Cal.com or a custom Supabase-backed scheduler).
- **CRM** — A `contacts` Supabase table (separate from siteData) for form submissions, leads, and customer records tied to a user's site. This is infrastructure, not a siteData field.

### Layer 3 — Publishing Infrastructure
Depends on auth and stable siteData schema.

- **Custom domains** — A domain mapping layer that links a custom domain to a published site UUID. Requires a `domains` Supabase table and Vercel domain API integration. The current `/site.html?id=` pattern is the fallback, not the destination.
- **Analytics** — A per-site event tracking identifier stored at publish time. Page views and CTA clicks should be captured server-side or via a lightweight edge function to avoid requiring the user to add tracking scripts.

### Layer 4 — AI & Editor Experience
These are the features most visible to the user and most aligned with the product vision.

- **Natural language editing** (partially exists) — Extend the current section-scoped modify flow to understand cross-section intent ("make the whole site feel more premium") and orchestrate multiple action objects in one response.
- **AI component placement** — The AI should be able to recommend where to insert new sections (before contact, after services) based on site context, using the `position` field in `EditorActions`.
- **AI logo generation** (partially exists) — Currently calls OpenAI for logo suggestions. Needs Vercel Blob storage and a proper asset management flow.
- **AI image generation** (partially exists) — Currently calls OpenAI for hero images. Needs the same asset management flow as logos.
- **Version history** (partially exists locally) — Extend the current 5-version localStorage history to server-side snapshots in Supabase, tied to the user's account.

### Layer 5 — Business Tools
Long-horizon features. Architectural impact depends on earlier layers being complete.

- **Business management tools** — Dashboard for managing leads, bookings, orders, and analytics in one place. Requires CRM, ecommerce, and booking layers to be complete.

---

## Technical Debt

These are known gaps that should not be built upon. Address them before the features that depend on them.

| Issue | Location | Risk | Notes |
|---|---|---|---|
| ~~`userId` hardcoded as `"demo-user"`~~ | ~~`index.html`, all save/load/delete API calls~~ | ~~All users share one project list~~ | **Fixed.** Clerk auth implemented in Layer 1. |
| `EditorActions` not wired to AI path | `api/modify.js` | AI returns raw JSON patches; multi-step mutations are fragile | The library is built for this. Next phase. |
| ~~HTML escaping missing in preview mode~~ | ~~`index.html` render path~~ | ~~XSS surface in the editor~~ | **Fixed.** `SiteSchema.escapeHtml()` now exported and applied to all preview render paths. |
| Non-standard OpenAI endpoint | `api/generate.js`, `api/modify.js` | Endpoint stability unknown | Both use `gpt-5.4` via `/v1/responses`, which is non-standard. Verify this is a stable production endpoint before scaling. |
| Normalization logic duplicated | `api/publish-site.js` vs `lib/site-schema.js` | The two copies can drift | `publish-site.js` re-implements normalization that already exists in `SiteSchema.normalizeSiteData()`. It should import the shared version. |
| No rate limiting on open AI routes | `api/generate.js`, `api/modify.js`, `api/generate-image.js`, `api/generate-logo.js` | Unrestricted OpenAI quota consumption | True rate limiting requires shared state (Vercel KV). **Deliberately deferred until pre-beta hardening.** Implement with `@vercel/kv` and a fail-open fallback when the time comes. |
| Supabase anon key used for write operations | All protected API routes | API layer is the only security gate; a leaked anon key + direct REST access bypasses it | Add `SUPABASE_SERVICE_ROLE_KEY` and switch protected routes to use it. Update RLS to deny anon writes. Low urgency while the codebase is not public. |

---

## Coding Standards

Follow these standards for all new code in this project.

### CSS and theming
- All visual styling must use `--site-*` CSS variables. Never hardcode colors, font families, border radii, or spacing values in new component markup.
- Adding a new visual property means adding a new variable to `buildThemeCssVariables()` in `lib/site-schema.js` first, then consuming it in `lib/site-theme.css`.
- Do not bypass `applyThemeStyles()` with inline style tags or direct element style manipulation.

### Rendering
- Every new component type or section type must support both render modes: `"preview"` (in `index.html`) and `"launched"` (in `site.html`). The `mode` parameter in `renderHomeSectionMarkup()` controls this.
- All user-generated content injected into innerHTML must be passed through `SiteSchema.escapeHtml()`. Both preview and launched modes are now covered. Any new component type or render path must follow the same pattern.

### Data model changes
- Any change to the siteData shape must bump `SCHEMA_VERSION` in `lib/site-schema.js`.
- Every schema change requires a migration branch inside `normalizeSiteData()` so that data stored under the previous version loads correctly.
- New top-level fields must have default values set inside `normalizeSiteData()`.

### AI mutation path
- New AI response handling should return typed action objects compatible with `EditorActions.applyActions()`, not raw JSON patches.
- `EditorActions` is the canonical way to mutate siteData. Extend it before adding new mutation patterns elsewhere.

### API routes
- Routes should be thin: validate input, make one AI or database call, return a response. Business logic belongs in `lib/`.
- Never duplicate logic from `lib/site-schema.js` inside an API route. Import or inline-require the shared module.

### Published sites
- Published sites are write-once. Never add logic that updates a `published_sites` row after creation.
- Share link URLs must remain valid indefinitely. Do not change the UUID-based URL scheme without a redirect strategy.

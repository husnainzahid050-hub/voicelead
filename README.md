# VoiceLead

**VoiceLead turns after-hours customer voice messages into qualified, actionable leads for local service businesses.**

MVP niche: dental clinics. Patients describe their need by voice in Urdu or English, VoiceLead structures it into a lead, and the clinic reviews it and follows up manually. AI assists; it never contacts patients or confirms appointments by itself.

> 🚧 In active development. This README is completed in Phase 6.

## Build status

| Phase | Scope                                                        | Status  |
| ----- | ------------------------------------------------------------ | ------- |
| 1     | Foundation: Next.js, Prisma schema, seed data, design tokens | ✅ Done |
| 2     | Authentication, onboarding, settings, roles                  | ✅ Done |
| 3     | Customer voice intake + Gemini extraction                    | ⏳      |
| 4     | Business dashboard, lead workflow, follow-up messages        | ⏳      |
| 5     | Rate limiting, authorization hardening, privacy flows, tests | ⏳      |
| 6     | Polish, accessibility, docs, Vercel deployment               | ⏳      |

## Tech stack

Next.js 16 (App Router) · TypeScript (strict) · Tailwind CSS v4 · shadcn-style UI · Prisma 7 · SQLite (dev) → PostgreSQL (prod) · Zod · Google Gemini · Vitest

## Local setup

Requires Node.js 20.19+.

```bash
npm install                 # also generates the Prisma client
cp .env.example .env        # then fill in the secrets (see comments in the file)
npm run db:migrate          # create the SQLite database
npm run db:seed             # load the SmileCare Dental demo data
npm run dev                 # http://localhost:3000
```

Useful scripts: `npm run check` (typecheck + lint + tests), `npm run db:studio`, `npm run db:reset`.

## Environment variables

See [`.env.example`](.env.example). All secrets are server-only and validated at startup; the server refuses to serve requests if any are missing or too short.

## Demo data

The seed creates a fictional **SmileCare Dental Clinic** (Muzaffarabad, Azad Kashmir) with 13 leads covering emergencies, cleanings, fillings, braces, a root canal, an incomplete lead and a duplicate-looking lead in Urdu, Roman Urdu and English. A second clinic, **Bright Smile Dental**, exists to prove tenant isolation. All people and phone numbers are invented.

| Account                  | Role                 |
| ------------------------ | -------------------- |
| `owner@smilecare.demo`   | Owner                |
| `staff@smilecare.demo`   | Staff                |
| `owner@brightsmile.demo` | Owner (other clinic) |

Password: the value of `DEMO_OWNER_PASSWORD` in your `.env`.

## Future roadmap (not in V1)

WhatsApp Business Cloud API · real phone-call voice agent · Google Calendar booking · SMS automation · multi-business SaaS onboarding · advanced analytics · premium voices.

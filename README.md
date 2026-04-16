# SceneFind

SceneFind is a pnpm workspace monorepo with:
- `apps/web`: user-facing React app for image/video-based movie detection.
- `apps/api`: Express API with OpenAI Vision detection, TMDB enrichment, Stripe endpoints, and usage limits.
- `apps/admin`: React admin dashboard for simple usage metrics.
- `packages/shared`: shared constants and config values.

## Implemented from your project markdown

- Drag-and-drop + file picker upload (`image/*`, `video/*` subset: JPG/PNG/WEBP/MP4/MOV)
- Video frame extraction on client before detect request
- `/api/detect` route with GPT-4o call and JSON-only parsing
- TMDB enrich step after model detection
- Stripe checkout + webhook endpoint stubs
- Paystack checkout for Nigeria users (auto-routed by country)
- Affiliate disclosure and provider links
- Plan-based usage control on server:
  - Anonymous: 2/day
  - Free verified user: 5/month
  - Pro: unlimited
  - API: 1000/day
- Client-side usage banner and local tracking (3/day)
- Mobile responsive layout (content width capped around 680px)

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Copy environment values:

```bash
cp .env.example .env
```

3. Run all apps:

```bash
pnpm dev
```

Ports:
- Web: `http://localhost:5173`
- Admin: `http://localhost:5174`
- API: `http://localhost:8787`

## API endpoints

- `POST /api/detect`
  - Body: `{ "base64Image": "...", "mediaType": "image/jpeg" }`
- `POST /api/checkout`
  - Body: `{ "plan": "pro" | "api", "email": "user@example.com" }`
  - Behavior: `NG` users go to Paystack, all others go to Stripe
- `POST /api/webhooks/stripe`
- `POST /api/webhooks/paystack`
- `GET /api/admin/metrics`
- `GET /api/health`

## Payment Routing

- Country detection uses `cf-ipcountry` (Cloudflare) and falls back to `x-user-country` for local testing.
- If country is `NG`, checkout is initialized with Paystack.
- For all other countries, checkout is initialized with Stripe.

Additional env vars for Paystack in `.env`:
- `PAYSTACK_PUBLIC_KEY`
- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_PLAN_PRO` (optional if using fixed amount)
- `PAYSTACK_PLAN_API` (optional if using fixed amount)
- `PAYSTACK_AMOUNT_PRO_KOBO` (fallback amount)
- `PAYSTACK_AMOUNT_API_KOBO` (fallback amount)

## Optional headers for server-side plan simulation

- `x-user-id`
- `x-user-plan` (`free`, `pro`, `api`)
- `x-user-email-verified` (`true` or `false`)

## Postgres and Redis notes

- Redis is used for usage counters when `REDIS_URL` is configured.
- Postgres logging uses `detection_logs` table if `DATABASE_URL` is configured.

Example table:

```sql
CREATE TABLE IF NOT EXISTS detection_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT,
  plan TEXT,
  media_type TEXT,
  found BOOLEAN,
  title TEXT,
  confidence TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## TODO alignment items

Your markdown includes two conflicting free limits (`2` without signup and `3/day` in UI). This repo currently keeps both intentionally:
- Frontend banner/local guard: 3/day
- Backend enforcement for anonymous: 2/day

If you want, I can align this to one policy in a follow-up.

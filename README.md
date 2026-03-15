# AutoPulse AI

Next.js MVP for the AutoPulse automotive forecasting portal.

## What is included

- TypeScript Next.js app using the App Router
- server-side connection to the Supabase Postgres database
- live historical registration visualizations based on the current `core` schema
- placeholder forecast visuals until `ml.fact_forecasts` is populated
- landing page, explore dashboard, series detail page, and roadmap page

## Environment

The app expects the existing Supabase variables in `.env`.

For database access it now prefers:

- `SUPABASE_SESSION_POOLER`
- fallback: `SUPABAE_SESSION_POOLER` (legacy typo still supported)
- fallback: `SUPABASE_DIRECT_CONNECT_URL`

## Run

```bash
npm install
npm run dev
```

## Notes

- Historical data is read from `core.fact_registrations` and related dimensions.
- Forecast values are currently synthetic placeholders and clearly labeled in the UI.
- The business-plan-driven feature roadmap lives in [`docs/mvp-feature-plan.md`](docs/mvp-feature-plan.md).

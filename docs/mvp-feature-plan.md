# AutoPulse AI MVP Feature Plan

This feature plan is derived from the current business plan and the existing Supabase data model.

## 1. Current MVP foundation

The frontend can already support:

- landing page with live historical registration charts,
- market dashboard pages for OEM and model-series exploration,
- placeholder 3 / 6 / 12 month forecast visuals,
- series detail pages prepared for confidence intervals,
- roadmap and methodology communication.

The current database scope behind this MVP is:

- `core.dim_oem`
- `core.dim_model`
- `core.dim_drive_type`
- `core.dim_series`
- `core.fact_registrations`

Because `ml.fact_forecasts` is not populated yet, forecast values in the UI are clearly labeled as placeholders.

## 2. Features to add next

### Phase A: Product usability

- richer filters for OEM, model, drive type, and time horizon,
- downloadable CSV exports,
- saved dashboard presets,
- responsive detail pages for consultants and analysts,
- methodology page that explains source coverage and limitations.

### Phase B: Monetization

- authentication,
- subscription tiers and gating,
- Stripe billing,
- export quotas by plan,
- account workspace and usage history.

### Phase C: Forecast productization

- replace placeholder forecasts with `ml.fact_forecasts`,
- expose forecast confidence intervals from the database,
- show run metadata from `ml_run` and `ml_run_series`,
- compare actuals vs. forecast drift,
- surface forecast versioning and refresh dates.

### Phase D: API and distribution

- authenticated forecast API,
- API docs and example queries,
- webhook or alert support,
- newsletter and market pulse summaries.

### Phase E: Differentiation

- news integration and linked context,
- scenario narratives: optimistic / neutral / pessimistic,
- explainability panels for “why the forecast changed,”
- exogenous feature views once `fact_exogenous_values` is available.

## 3. Immediate backend prerequisites

To unlock the next frontend step cleanly, the backend should add:

- a stable feed into `ml.fact_forecasts`,
- model run metadata in `ml_run`,
- product-safe views or APIs for frontend consumption,
- optional app schema views that avoid complex joins in the frontend.

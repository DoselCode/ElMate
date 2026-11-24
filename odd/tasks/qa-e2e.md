# QA and E2E for ElMate (develop)

Objective: use-case document, manual QA run against the Coolify `develop` environment with a bug report, and Playwright E2E specs for the critical flows.
Branch: `feature/qa-e2e` · Delivery: ask-on-risk · Runners: Vitest (unit/db), Playwright (E2E, new).
Target: https://develop.187.41.122.109.sslip.io (Coolify app `el-mate:develop`).

## Specs

- S1. "necesito hacer tareas de qa, casos de uso y qa end to end" — deliver a use-case document covering the public site and the admin panel.
- S2. Execute those use cases manually against develop and report results and bugs.
- S3. Automate the critical flows as Playwright E2E specs in the repo, runnable against develop (base URL configurable).
- S4. Admin credentials are never committed or typed by the agent; E2E reads them from environment variables (assumption).

## Tasks

| ID | Specs | Route | Status | Evidence |
|---|---|---|---|---|
| T1 | S1 | inline | done | `docs/qa/casos-de-uso.md` |
| T2 | S2 | inline | public done; admin pending login | `docs/qa/reporte-qa-develop.md` |
| T3 | S3, S4 | inline | public + auth done; admin flows pending | `e2e/`, `playwright.config.ts` |
| T4 | S3 | inline | done for public | 16 passed, 1 failed (BUG-01, expected), 1 skipped (CU-20, no creds) |
| T5 | S2, S3 | inline | done (CU-23 empleado, CU-31, real cash close pending) | report updated; `e2e/admin/panel.spec.ts`, `e2e/admin/stock-and-sales.spec.ts` (unverified: no credentials) |

## Log

- L1 (2026-11-17): "necesito hacer tareas de qa, casos de uso y qa end to end" — user chose "Ambos": use cases + manual run + report, then Playwright automation.
- L2: public site explored on develop. Home, tienda, producto and cart → WhatsApp link work. Bug candidates: "-100%" discount badge on "Aguantadora Suave 500 g" ($4.587,50 → $22), broken hero text ("S d d"), product named "Test" in Destacados, products without images.

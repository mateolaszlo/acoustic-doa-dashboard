# Acoustic DOA Dashboard

React + TypeScript web interface for monitoring 360° Direction-of-Arrival (DOA) telemetry, configuring room layouts and virtual PTZ cameras, and managing hardware nodes.

## Requirements

- Node.js 20+ and npm 10+
- Running `acoustic-doa-backend` instance

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

Make sure `VITE_BACKEND_HTTPS_URL` in `.env` matches your backend's HTTPS port (for example `https://localhost:3443` or `https://localhost:8443`).

When running `npm run dev`:
- The dashboard opens at **`https://localhost:5173`** (set `VITE_ENABLE_HTTPS=false` in `.env` if you prefer HTTP).
- Missing local TLS certificates in `certs/` are generated automatically on startup via `certs/ensure_certs.mjs`.
- Requests to `/api/*` are proxied directly to `VITE_BACKEND_HTTPS_URL`.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start Vite dev server on port `5173` |
| `npm run build` | Type-check (`tsc`) and build production bundle to `dist/` |
| `npm run preview` | Preview the production `dist/` build locally |
| `npm run certs:generate` | Manually generate local SAN TLS certificates in `certs/` |
| `npm test` | Run Vitest unit tests (`vitest run`) |

## Features & Access Roles

Authentication is required before viewing telemetry or streams (`HttpOnly` cookie session, no anonymous access):

- **Viewer:** Monitors the Smart Meeting Director canvas (pan/zoom), active speaker cards, diarization timeline, acoustic heatmaps, and live telemetry logs read-only.
- **Admin:** All viewer capabilities plus room layout/table/chair editing, 1–3 PTZ camera studio tuning, spatial geofence editing, DSP calibration & zero-angle trim, hardware node/API key management, and user role administration.

## Project Structure

```text
acoustic-doa-dashboard/
├── src/
│   ├── components/   # Radar, meeting director, calibration, analytics, auth, admin, layout
│   ├── context/      # AuthContext (HttpOnly session state)
│   ├── hooks/        # SSE stream, device config, spatial zones, diarization, PTZ director
│   ├── services/     # API client, error formatting, radar/PTZ math, multipath analyzer
│   └── types/        # Shared TypeScript API types
├── certs/            # Auto & manual SAN TLS certificate generation scripts
├── test/             # Vitest unit tests
└── vite.config.ts    # Dev/preview HTTPS setup and /api proxy configuration
```

# Acoustic DOA Web Dashboard & Visualizer (Client 2)

A real-time, browser-based 360° polar radar visualizer, telemetry monitor, and remote calibration controller for **ESP32 Acoustic Direction of Arrival (DOA)** arrays.

---

## 🌟 Key Features

- **Dual Operating Modes (`MEETING` Studio Director vs `DSP` Acoustic Radar):**
  - **Meeting Studio Director Mode:** Interactive architectural floorplan (`SmartRoomDirectorCanvas`) displaying active & coasting speaker bearings, camera fields of view (`cam-front`, `cam-rear`, `cam-side`), active-speaker cards, and a real-time multi-speaker diarization timeline (`DiarizationTimeline`).
  - **1–3 Camera Rig & Authoritative PTZ Sync:** Supports configurable `1-CAMERA`, `2-CAMERAS`, and `3-CAMERAS` studio rigs (`CameraStudioConfigModal`) with sticky lock during brief pauses/coasting, zone-aware priority cuts, and bidirectional synchronization via `GET/PUT /api/v1/devices/:id/studio` and live `studio_config` SSE updates.
  - **Interactive Room Furniture & Navigation:** Supports `oval`, `round`, and `ushape` tables, adjustable dimensions and seat counts, draggable individual custom chairs (with one-click Auto-Arrange reset to server `customChairs: null`), spatial geofence overlays, seamless infinite grid pan/zoom, and resizable canvas height.
  - **High-DPI 360° Polar Radar Scope (DSP Mode):**
    - Real-time 60 FPS Canvas rendering matching the physical acoustic array coordinate system ($0^\circ$ Front/North, $+90^\circ$ Right/East, $\pm 180^\circ$ Back/South, $-90^\circ$ Left/West).
    - Multi-source simultaneous CLEAN beam visualization, radial tick markings, analog phosphor persistence trails, dB SPL color coding, and confidence-scaled needles.
    - Integrated multipath / reverberation diagnostics card (`MultipathAnalyzerCard`).
- **Spatial Room Geofencing (`SpatialZoneEditorModal`):**
  - Define named acoustic sectors (`Podium`, `Main Table`, `Priority`, `Ignore`, `Mute`, `Zone`), including circular wrap-around sectors crossing $\pm 180^\circ$, persisted server-side via `PUT /api/v1/devices/:id/zones`.
- **Hardware Node & API Key Management Panel (Admin):**
  - Dedicated administrative dashboard to provision new physical ESP32 arrays, securely reveal and copy API keys, rotate keys with instant backend invalidation, rename nodes, and decommission hardware.
  - 2-step safe historical data purge action to reclaim database storage without resetting device calibration or interrupting active live telemetry streams.
- **Role-Based Access Control (RBAC):**
  - JWT login/registration modal (`admin` / `viewer`) and admin User Management panel (`UserManagementPanel`).
- **Pure HTTPS REST-API & Server-Sent Events (SSE):**
  - Native browser `EventSource` connection to `GET /api/v1/devices/:id/stream` receiving `measurement_batch` (normalized frames, active MTT tracks, authoritative director telemetry) and `studio_config` live updates.
- **Remote Device Calibration & Zero-Angle Wizard (Admin):**
  - Modify microphone array geometry ($d$ in mm), rotational zero-angle trim ($\phi_{\text{offset}}$), trigger SPL thresholds, GCC-PHAT correlation cutoffs, adaptive noise tracking, sector transition widths/hysteresis, tracker hold timeouts, and audio sample rates (44.1 kHz vs 48 kHz), plus 1-click boresight Zero-Angle calibration.
- **Acoustic Heatmap & Event Log:**
  - 36-bin angular rose diagram (`15m`, `1h`, `24h`) and searchable/confidence-filterable event table with CSV export.

---

## 🚀 Quick Start

### 1. Requirements
- Node.js 20.x or higher
- npm 10.x or higher
- Running `acoustic-doa-backend` server on port 3000 / 3443

### 2. Installation
```bash
npm install
```

### 3. Run Development Server
```bash
npm run dev
```

Open `http://localhost:5173` in your browser. The Vite proxy forwards `/api` requests to the local backend.

### 4. Run Unit Tests
```bash
npm test
```

### 5. Build for Production
```bash
npm run build
```

---

## 🏗️ Architecture & Communication Flow

```
+-----------------------------------------------------------+
|               ESP32 Edge Node (Client 1)                  |
|   4-Mic INMP441 Array -> GCC-PHAT DSP -> REST Client     |
+-----------------------------------------------------------+
                              |
       POST /measurements (Binary batch, 5 Hz)
       GET /calibration (Every 60s)
                              v
+-----------------------------------------------------------+
|              acoustic-doa-backend (Server)                |
|   Binary Decoder -> MTT + PTZ Director -> SQLite -> SSE   |
+-----------------------------------------------------------+
                              |
       GET /devices/1/stream (SSE: telemetry + studio_config)
       GET & PUT /devices/1/studio (Layout & 1-3 cameras)
       GET & PUT /devices/1/zones (Spatial geofences)
       GET & PUT /devices/1/config (Calibration)
       GET /devices/1/stats (Acoustic heatmaps)
                              v
+-----------------------------------------------------------+
|         acoustic-doa-dashboard (Client 2 - React)         |
|   Studio Director & 60 FPS Radar -> Remote Config         |
+-----------------------------------------------------------+
```

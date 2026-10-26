# Acoustic DOA Web Dashboard & Visualizer (Client 2)

A real-time, browser-based 360° polar radar visualizer, telemetry monitor, and remote calibration controller for **ESP32 Acoustic Direction of Arrival (DOA)** arrays.

---

## 🌟 Key Features

- **High-DPI 360° Polar Radar Scope:**
  - Real-time 60 FPS Canvas rendering matching the physical acoustic array coordinate system ($0^\circ$ Front/North, $+90^\circ$ Right/East, $\pm 180^\circ$ Back/South, $-90^\circ$ Left/West).
  - Analog-style phosphor persistence decay trail to visualize sound source movement and multipath reflections.
  - Sound Pressure Level (dB SPL) dynamic color coding (Green < 60 dB, Amber 60–75 dB, Crimson > 75 dB).
  - Active detection needles with vector length scaled by correlation confidence.
- **Pure HTTPS REST-API & Server-Sent Events (SSE):**
  - Native browser `EventSource` connection to `GET /api/v1/devices/:id/stream` delivering sub-20ms latency updates without WebSocket protocol switching or middlebox disconnects.
- **Remote Device Calibration Panel:**
  - Modify microphone array geometry ($d$ in mm), rotational zero-angle trim ($\phi_{\text{offset}}$), trigger SPL thresholds, GCC-PHAT correlation cutoffs, adaptive noise tracking, and audio sample rates (44.1 kHz vs 48 kHz).
  - Synchronizes to the ESP32 automatically on its next 60s calibration poll.
- **1-Click Zero-Angle Calibration Wizard:**
  - Samples incoming acoustic detections, calculates the circular mean azimuth, and automatically applies the rotational offset to boresight the array at $0^\circ$.
- **Acoustic Heatmap & Angular Rose Diagram:**
  - 36-bin angular histogram ($10^\circ$ slices from $-180^\circ$ to $+180^\circ$) displaying directional sound distribution across 15m, 1h, or 24h timeframes.
- **Live Event Log & CSV Export:**
  - Searchable, confidence-filterable log of all detected acoustic events with one-click CSV download.

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
|   Binary Decoder -> SQLite (WAL) -> SSE Event Hub         |
+-----------------------------------------------------------+
                              |
       GET /devices/1/stream (SSE, <20ms push)
       GET & PUT /devices/1/config (Calibration)
       GET /devices/1/stats (Acoustic heatmaps)
                              v
+-----------------------------------------------------------+
|         acoustic-doa-dashboard (Client 2 - React)         |
|   60 FPS Radar Canvas -> Remote Config -> Heatmaps       |
+-----------------------------------------------------------+
```

# Dual-Face Acoustic Intelligence Platform

## Problem Statement
How might we provide an intuitive, high-level meeting room director with simulated PTZ camera steering and speaker diarization for general users, while preserving an industrial-grade DSP diagnostic and reverberation test bench for hardware engineers?

## Recommended Direction
Split the application into two purpose-built viewports driven by user role and context:

1. **Meeting Room Director (Viewer Mode)**:
   - **Simulated PTZ Camera Scope**: 2D conference room visualization showing active speakers and a smooth camera optical cone (FOV 60°) panning toward the active speaker with configurable slew inertia ($25^\circ-35^\circ/\text{s}$).
   - **Speaker Diarization Cards**: Status tiles for Slot 0 (Emerald) and Slot 1 (Indigo) showing live activity, speech duration, current angular sector, and talk-time percentage pie chart.
   - **Spatial Room Zones**: Visual tags for designated areas ("Podium", "Audience Left", "Audience Right", "Doorway") highlighting which zone is currently active.
   - **Session Timeline & Cross-Talk Monitor**: Timeline displaying who spoke when and flagging simultaneous speech / cross-talk.

2. **DSP & Acoustic Engineering Bench (Admin Mode)**:
   - **360° Polar Vector Scope**: Full raw vector blip decay trails, instantaneous wavefront delay ($\Delta t$ in µs), and sweep indicators.
   - **Multipath & Reverberation Analyzer**: Direct-to-Reverberant Ratio (DRR) meter contrasting primary direct arrivals vs secondary CLEAN reflections.
   - **Remote Array Hardware Tuning**: Physical microphone spacing trim, zero-angle acoustic calibration, sector width, boundary hysteresis, and hold timeout sliders.
   - **Protocol & Clock Diagnostics**: IEEE 802.3 CRC32 verification rate, Hermite slew clock fusion status, and network batch telemetry.

## Key Assumptions to Validate
- [ ] Simulated camera pan damping (critically-damped spring-damper) feels natural without lagging behind quick speaker handoffs.
- [ ] Firmware hold timeout (default 2500ms) adequately preserves diarization continuity over normal conversational pauses.
- [ ] Angular geofence zones can be persisted in backend SQLite (`spatial_zones` table) and edited via admin API.

## MVP Scope
### Phase 1: Viewer Mode "Room Director"
- Role-based landing: Default unauthenticated visitors land directly on the Meeting Director.
- Live Speaker Cards (Slot 0 and Slot 1) with active/speaking badges and percentage talk-time gauges.
- Simulated PTZ Camera FOV overlay on the room canvas with critically-damped smooth panning.
- Spatial Zones ("Podium / Stage", "Audience Left", "Audience Right", "Rear Gallery").
- Timeline ribbon tracking speaker turns and cross-talk.

### Phase 2: Admin Mode Diagnostics & Reverb Tools
- "Switch to DSP Workbench" toggle in Header, accessible to Admins (prompts auth modal for viewers).
- Multipath / Reverberation indicator deriving DRR in dB from secondary CLEAN passes.
- Interactive Zone Editor modal: Define custom zone angles, colors, and names saved via backend API.

## Not Doing (and Why)
- Voice Biometric Recognition: The ESP32 streams directional acoustic metadata, not raw audio PCM. Attempting voice fingerprinting without raw audio is impossible.
- Hardware PTZ RS-485 / VISCA Camera Control: Keep the camera visualization simulated in canvas first; hardware serial camera control should remain decoupled or handled via external webhooks.
- Multi-node 3D triangulation: Keep single-array 2D azimuth focus for now until multi-node physical coordinate calibration is established.

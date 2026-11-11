export type SectorEventType = 1 | 2 | 3 | 4;
export type SectorEventName = 'ENTER' | 'MOVE' | 'HEARTBEAT' | 'LEAVE';

export interface AcousticTrack {
  trackId: number;
  trackSlot: number; // 0 = Primary (Emerald), 1 = Secondary (Indigo), 2 = Tertiary (Sky-Blue)
  sectorId?: number | null;
  lastEventType?: SectorEventName | null;
  state: 'ACTIVE' | 'COASTING' | 'TENTATIVE' | 'DELETED';
  angleDeg: number; // Kalman-smoothed azimuth [-180, +180]
  rawAngleDeg: number;
  velocityDegPerSec: number;
  soundLevelDb: number;
  confidence: number;
  hits: number;
  lastUpdatedMs: number;
  ageMs: number;
}

export interface MeasurementEvent {
  timestampMs: number;
  rawTimestampMs?: number;
  syncQuality?: number;
  sessionId?: number;
  trackId?: number;
  trackSlot?: number;
  trackState?: 'ACTIVE' | 'COASTING' | 'TENTATIVE' | 'DELETED';
  slotId?: number;
  sectorId?: number;
  eventType?: SectorEventType;
  eventTypeName?: SectorEventName;
  activeSources?: number;
  smoothedAngleDeg?: number;
  angularVelocityDegPerSec?: number;
  angleDeg: number;
  delayUs: number;
  soundLevelDb: number;
  confidence: number;
}

export interface MeasurementBatchPayload {
  deviceId: number;
  clockFlags: number;
  clockSource: 'SNTP_UTC' | 'SERVER_UTC' | 'MONOTONIC_UPTIME' | 'UNKNOWN';
  baseTimestampMs: number;
  crcVerified?: boolean;
  records: MeasurementEvent[];
  activeTracks?: AcousticTrack[];
}

export interface DeviceCalibration {
  device_id: number;
  microphone_distance_m: number;
  sample_rate: number;
  window_size: number;
  correlation_threshold: number;
  sound_level_threshold_db: number;
  db_spl_offset: number;
  angle_offset_deg: number;
  adaptive_threshold_enabled: boolean;
  snr_margin_db: number;
  sector_width_deg: number;
  sector_hysteresis_deg: number;
  tracker_hold_timeout_ms: number;
  server_time_unix_ms: number;
}

export interface AcousticStats {
  deviceId: number;
  timeframe: string;
  eventCount: number;
  avgSplDb: number;
  peakSplDb: number;
  angularBins36: number[];
}

export interface DeviceSummary {
  id: number;
  name: string;
  status: 'online' | 'offline';
  last_seen_at: string | null;
  clock_status: string;
  sample_rate: number;
}

export interface DeviceAdminDetails extends DeviceSummary {
  api_key?: string;
  created_at?: string;
  total_events?: number;
}

export type UserRole = 'admin' | 'viewer';

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  role: UserRole;
}

export interface UserRecord {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  created_at: string;
  last_login_at: string | null;
}

export type DashboardMode = 'MEETING' | 'DSP';

export interface SpatialZone {
  id?: number;
  device_id?: number;
  name: string;
  min_angle_deg: number;
  max_angle_deg: number;
  color: string;
  alert_threshold_db?: number;
  created_at?: string;
}

export interface SpeakerSessionStats {
  slotId: number; // 0 or 1
  isActive: boolean;
  currentAngleDeg: number | null;
  currentZone: string;
  currentSplDb: number;
  totalSpeakingTimeMs: number;
  turnCount: number;
  lastActiveMs: number;
}

export interface DiarizationTimelineSegment {
  id: string;
  timestampMs: number;
  slotId: number; // 0 = Speaker 1 (Emerald), 1 = Speaker 2 (Indigo)
  durationMs: number;
  zoneName: string;
  avgSplDb: number;
  isCrossTalk: boolean;
}

export interface MeetingSessionAnalytics {
  totalDurationMs: number;
  speaker0TimeMs: number;
  speaker1TimeMs: number;
  crossTalkTimeMs: number;
  silenceTimeMs: number;
  speaker0Turns: number;
  speaker1Turns: number;
  crossTalkCount: number;
}

export interface MultipathReflection {
  slotId: number;
  angleDeg: number;
  delayUs: number;
  soundLevelDb: number;
  confidence: number;
  deltaAngleDeg: number;
  relativeSplDb: number;
}

export interface MultipathMetrics {
  directSplDb: number;
  reverbSplDb: number;
  drrDb: number;
  reverbState: 'DRY' | 'CONTROLLED' | 'REVERBERANT';
  reflections: MultipathReflection[];
}

export interface VirtualCamera {
  id: string; // 'cam-front', 'cam-rear', 'cam-side'
  name: string; // 'Front Stage Cam', 'Rear Audience Cam', 'Side Profile Cam'
  xRatio: number; // 0..1 (fraction of canvas width)
  yRatio: number; // 0..1 (fraction of canvas height)
  restingPanDeg: number; // Default resting pan angle
  currentPanDeg: number;
  targetPanDeg: number;
  fovDeg: number; // e.g. 60°
  color: string;
  isLive: boolean; // "ON AIR"
  role: 'front' | 'rear' | 'side';
}

export interface CameraDirectorConfig {
  slewSpeedDegPerSec: number; // e.g. 120°/s
  instantCut: boolean; // true = instant broadcast cut, false = smooth slew
  holdTimeMs: number; // e.g. 1800ms
  confirmTimeMs: number; // e.g. 350ms
  hysteresisMarginPercent: number; // e.g. 20%
}




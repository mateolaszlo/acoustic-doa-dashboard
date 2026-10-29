export interface MeasurementEvent {
  timestampMs: number;
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


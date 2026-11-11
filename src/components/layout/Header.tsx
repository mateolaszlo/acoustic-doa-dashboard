import React, { useState, useEffect } from 'react';
import {
  Radar,
  Radio,
  BookOpen,
  Shield,
  LogIn,
  LogOut,
  User,
  Volume2,
  VolumeX,
  RefreshCw,
  Camera,
  Lock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { DeviceSummary, DashboardMode } from '../../types/api_types.js';

interface HeaderProps {
  deviceId: number;
  connected: boolean;
  eventCount: number;
  globalEventCount?: number;
  isAudioEnabled: boolean;
  mode: DashboardMode;
  onChangeMode: (mode: DashboardMode) => void;
  onToggleAudio: () => void;
  onOpenAuth: () => void;
  onSelectDevice?: (id: number) => void;
  onReconnect?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  deviceId,
  connected,
  eventCount,
  globalEventCount,
  isAudioEnabled,
  mode,
  onChangeMode,
  onToggleAudio,
  onOpenAuth,
  onSelectDevice,
  onReconnect,
}) => {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const [devices, setDevices] = useState<DeviceSummary[]>([]);

  useEffect(() => {
    fetch('/api/v1/devices')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setDevices(data);
        }
      })
      .catch(() => {});
  }, [connected]);

  return (
    <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-3 space-y-2.5">
        {/* Tier 1: Main Platform Brand & Live Telemetry / Auth Group */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Brand & Array Title */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-950/80 border border-emerald-800 text-emerald-400 rounded-xl shadow-lg shadow-emerald-950/40">
              <Radar className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-white">
                  ACOUSTIC DOA RADAR
                </h1>
                <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800/80 px-2 py-0.5 rounded-full font-mono font-semibold">
                  GCC-PHAT / WLS
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Quad-MEMS Planar Array &bull; Real-Time Sound Source Localization
              </p>
            </div>
          </div>

          {/* Right Status & Utility Bar */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Stream Status & Counter Badges */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono">
              <span
                className={`w-2 h-2 rounded-full ${
                  connected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                }`}
              />
              <span className="text-slate-400 font-semibold">
                {connected ? 'LIVE' : 'OFFLINE'}
              </span>
              <span className="text-slate-700">|</span>
              <span title="Events captured in this browser session" className="flex items-center gap-1">
                <span className="text-emerald-400 font-bold tabular-nums">
                  {eventCount.toLocaleString()}
                </span>
                <span className="text-slate-500 text-[10px]">session</span>
              </span>
              {globalEventCount !== undefined && (
                <>
                  <span className="text-slate-700">|</span>
                  <span title="Total all-time events in database" className="flex items-center gap-1">
                    <span className="text-cyan-400 font-bold tabular-nums">
                      {globalEventCount.toLocaleString()}
                    </span>
                    <span className="text-slate-500 text-[10px]">global</span>
                  </span>
                </>
              )}
              {!connected && onReconnect && (
                <button
                  onClick={onReconnect}
                  title="Reconnect to stream"
                  className="ml-1 p-0.5 hover:text-emerald-400 transition"
                >
                  <RefreshCw className="w-3 h-3 text-slate-400 hover:text-emerald-400" />
                </button>
              )}
            </div>

            {/* Audio Monitor Mode Toggle */}
            <button
              onClick={onToggleAudio}
              title={isAudioEnabled ? 'Mute acoustic sonar ping' : 'Enable acoustic sonar ping on sound triggers'}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition ${
                isAudioEnabled
                  ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {isAudioEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isAudioEnabled ? 'AUDIO ON' : 'MUTED'}</span>
            </button>

            {/* Role & Auth Portal */}
            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                    isAdmin
                      ? 'bg-purple-950/80 border-purple-800 text-purple-300'
                      : 'bg-blue-950/80 border-blue-800 text-blue-300'
                  }`}
                >
                  {isAdmin ? (
                    <Shield className="w-3.5 h-3.5 text-purple-400" />
                  ) : (
                    <User className="w-3.5 h-3.5 text-blue-400" />
                  )}
                  <span>
                    {isAdmin ? 'ADMIN' : 'VIEWER'}: {user?.username}
                  </span>
                </div>
                <button
                  onClick={logout}
                  title="Sign Out"
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg text-xs font-semibold transition"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-400" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900 border border-slate-800 text-slate-400 rounded-lg text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-slate-500" />
                  <span className="hidden sm:inline">VIEWER MODE</span>
                </div>
                <button
                  onClick={onOpenAuth}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition shadow-md shadow-emerald-950/50"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tier 2: Operational Navigation & Mode Switcher Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
          {/* Prominent Center-Left Dual Mode Switcher */}
          <div className="flex items-center p-1 rounded-xl bg-slate-900/90 border border-slate-800 text-xs shadow-inner">
            <button
              onClick={() => onChangeMode('MEETING')}
              className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg font-medium transition ${
                mode === 'MEETING'
                  ? 'bg-emerald-600 text-slate-950 font-bold shadow-md shadow-emerald-950/60'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>Smart Meeting Director</span>
            </button>
            <button
              onClick={() => {
                if (!isAdmin) {
                  onOpenAuth();
                } else {
                  onChangeMode('DSP');
                }
              }}
              className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg font-medium transition ${
                mode === 'DSP'
                  ? 'bg-purple-600 text-white font-bold shadow-md shadow-purple-950/60'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title={isAdmin ? 'Switch to DSP Engineering Bench' : 'Sign in as Administrator to access low-level DSP Bench'}
            >
              <Radio className="w-4 h-4" />
              <span>DSP Engineering Lab</span>
              {!isAdmin && <Lock className="w-3 h-3 text-slate-500 ml-0.5" />}
            </button>
          </div>

          {/* Quick Context Tools: Node Selector & OpenAPI link */}
          <div className="flex items-center space-x-2">
            {/* Active Device / Node Selector */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-slate-300">
              <Radio className="w-3 h-3 text-emerald-400" />
              {devices.length > 1 && onSelectDevice ? (
                <select
                  value={deviceId}
                  onChange={(e) => onSelectDevice(parseInt(e.target.value, 10))}
                  className="bg-transparent text-emerald-400 font-bold focus:outline-none cursor-pointer"
                >
                  {devices.map((d) => (
                    <option key={d.id} value={d.id} className="bg-slate-900 text-white">
                      NODE #{d.id} ({d.name})
                    </option>
                  ))}
                </select>
              ) : (
                <span>NODE: #{deviceId}</span>
              )}
            </div>

            {/* Swagger OpenAPI Link */}
            <a
              href="/api/docs"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg text-xs font-medium transition"
              title="Open Swagger REST API Interactive Explorer"
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
              <span>OpenAPI Docs</span>
            </a>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

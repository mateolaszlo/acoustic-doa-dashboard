import { useState, useEffect } from 'react';
import { Header } from './components/layout/Header.js';
import { PolarRadarCanvas } from './components/radar/PolarRadarCanvas.js';
import { TelemetryGauges } from './components/metrics/TelemetryGauges.js';
import { CalibrationPanel } from './components/calibration/CalibrationPanel.js';
import { AcousticHeatmap } from './components/analytics/AcousticHeatmap.js';
import { EventLogTable } from './components/analytics/EventLogTable.js';
import { UserManagementPanel } from './components/admin/UserManagementPanel.js';
import { AuthModal } from './components/auth/AuthModal.js';
import { useSSEStream } from './hooks/useSSEStream.js';
import { useDeviceConfig } from './hooks/useDeviceConfig.js';
import { useAuth } from './context/AuthContext.js';
import { playSonarPing } from './services/audio_chime.js';
import { Sliders, PieChart, ListFilter, Users } from 'lucide-react';

type TabType = 'calibration' | 'analytics' | 'logs' | 'users';

export function App() {
  const [deviceId, setDeviceId] = useState(1);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const { token, isAdmin } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('analytics');

  // Real-time Server-Sent Events stream from backend
  const {
    connected,
    recentEvents,
    latestBatch,
    bufferLimit,
    setBufferLimit,
    clockSource,
    crcVerified,
    totalEventCount,
    globalEventCount,
    clearEvents,
    reconnect,
  } = useSSEStream({
    deviceId,
    maxBufferLength: 500,
  });

  // Remote device configuration & calibration hook
  const {
    config,
    loading: configLoading,
    error: configError,
    successMsg,
    updateConfig,
    calibrateZeroAngle,
  } = useDeviceConfig(deviceId, token);

  // If role changes or user logs out while viewing an admin-only tab, fall back to analytics
  useEffect(() => {
    if (!isAdmin && (activeTab === 'calibration' || activeTab === 'users')) {
      setActiveTab('analytics');
    }
  }, [isAdmin, activeTab]);

  const primaryEvent = recentEvents[0];

  // Optional acoustic monitor: emit synthesized sonar chirp on high-SPL sound events
  useEffect(() => {
    if (isAudioEnabled && primaryEvent && primaryEvent.soundLevelDb >= 58.0) {
      playSonarPing(primaryEvent.soundLevelDb >= 75.0 ? 1150 : 880);
    }
  }, [primaryEvent?.timestampMs, isAudioEnabled]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header
        deviceId={deviceId}
        connected={connected}
        eventCount={totalEventCount}
        globalEventCount={globalEventCount}
        isAudioEnabled={isAudioEnabled}
        onToggleAudio={() => setIsAudioEnabled((a) => !a)}
        onSelectDevice={setDeviceId}
        onReconnect={reconnect}
        onOpenAuth={() => setIsAuthModalOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 space-y-6">
        {/* Top Hero Section: Polar Radar Scope + Live Telemetry Gauges (Locked Position) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* 360° Polar Radar Canvas */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <PolarRadarCanvas latestEvents={recentEvents.slice(0, 3)} decayTimeMs={2500} showSweep={true} />
            <div className="flex items-center gap-4 text-xs font-mono text-slate-400 mt-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> &lt;60 dB (Ambient)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> 60-75 dB
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" /> &gt;75 dB (Loud)
              </span>
            </div>
          </div>

          {/* Telemetry Strip & Vector Summary */}
          <div className="lg:col-span-7 space-y-4">
            <TelemetryGauges
              latestEvent={primaryEvent}
              clockSource={clockSource}
              crcVerified={crcVerified}
              connected={connected}
            />

            {/* Live Acoustic Vector Details Card */}
            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3 shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <span className="text-xs font-mono uppercase text-slate-400 tracking-wider">
                  Real-Time Acoustic Wavefront Vector
                </span>
                <span
                  className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
                    connected
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : 'bg-rose-950 text-rose-400 border border-rose-800'
                  }`}
                >
                  {connected ? 'LINK ACTIVE' : 'OFFLINE'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div>
                  <span className="text-slate-500 text-[10px] block">PRIMARY AZIMUTH</span>
                  <span className="text-white font-bold text-sm">
                    {primaryEvent
                      ? `${primaryEvent.angleDeg > 0 ? '+' : ''}${primaryEvent.angleDeg.toFixed(1)}°`
                      : '--'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">WAVEFRONT DELAY</span>
                  <span className="text-slate-300 font-bold text-sm">
                    {primaryEvent
                      ? `${primaryEvent.delayUs > 0 ? '+' : ''}${primaryEvent.delayUs.toFixed(1)} µs`
                      : '--'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">SOUND LEVEL</span>
                  <span className="text-emerald-400 font-bold text-sm">
                    {primaryEvent ? `${primaryEvent.soundLevelDb.toFixed(1)} dB` : '--'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">PHAT CONFIDENCE</span>
                  <span className="text-slate-300 font-bold text-sm">
                    {primaryEvent ? `${Math.round(primaryEvent.confidence * 100)}%` : '--'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Workspace Sub-Dashboard Section (Full Width, Locked Position) */}
        <div className="space-y-4 pt-2">
          {/* Navigation Tabs Bar */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-px overflow-x-auto whitespace-nowrap">
            {isAdmin && (
              <button
                onClick={() => setActiveTab('calibration')}
                className={`flex items-center gap-2 py-2.5 px-4 text-xs font-semibold border-b-2 transition shrink-0 ${
                  activeTab === 'calibration'
                    ? 'border-emerald-500 text-emerald-400 font-bold'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Sliders className="w-4 h-4" />
                <span>Device Calibration & Setup</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-2 py-2.5 px-4 text-xs font-semibold border-b-2 transition shrink-0 ${
                activeTab === 'analytics'
                  ? 'border-emerald-500 text-emerald-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <PieChart className="w-4 h-4" />
              <span>Acoustic Heatmap & Stats</span>
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-2 py-2.5 px-4 text-xs font-semibold border-b-2 transition shrink-0 ${
                activeTab === 'logs'
                  ? 'border-emerald-500 text-emerald-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <ListFilter className="w-4 h-4" />
              <span>Live Event Log</span>
              <span className="ml-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {recentEvents.length}
              </span>
            </button>

            {isAdmin && (
              <button
                onClick={() => setActiveTab('users')}
                className={`flex items-center gap-2 py-2.5 px-4 text-xs font-semibold border-b-2 transition shrink-0 ${
                  activeTab === 'users'
                    ? 'border-purple-500 text-purple-400 font-bold'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>User Management</span>
              </button>
            )}
          </div>

          {/* Active Tab Panel */}
          <div>
            {isAdmin && activeTab === 'calibration' && (
              <CalibrationPanel
                config={config}
                loading={configLoading}
                error={configError}
                successMsg={successMsg}
                onUpdate={updateConfig}
                onCalibrateZeroAngle={calibrateZeroAngle}
              />
            )}

            {activeTab === 'analytics' && (
              <AcousticHeatmap deviceId={deviceId} latestBatch={latestBatch} />
            )}

            {activeTab === 'logs' && (
              <EventLogTable
                events={recentEvents}
                totalStreamCount={totalEventCount}
                bufferLimit={bufferLimit}
                onSetBufferLimit={setBufferLimit}
                onClearEvents={clearEvents}
              />
            )}

            {isAdmin && activeTab === 'users' && <UserManagementPanel />}
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-900 py-4 px-6 text-center text-xs text-slate-600 font-mono">
        Acoustic Direction of Arrival Platform &bull; Seminar iz načrtovanja in razvoja programske opreme v telekomunikacijah (FE UL)
      </footer>

      {/* Authentication / Registration Modal */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
}

export default App;

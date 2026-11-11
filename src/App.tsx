import { useState, useEffect } from 'react';
import { Header } from './components/layout/Header.js';
import { PolarRadarCanvas } from './components/radar/PolarRadarCanvas.js';
import { TelemetryGauges } from './components/metrics/TelemetryGauges.js';
import { CalibrationPanel } from './components/calibration/CalibrationPanel.js';
import { AcousticHeatmap } from './components/analytics/AcousticHeatmap.js';
import { EventLogTable } from './components/analytics/EventLogTable.js';
import { UserManagementPanel } from './components/admin/UserManagementPanel.js';
import { NodeManagementPanel } from './components/admin/NodeManagementPanel.js';
import { AuthModal } from './components/auth/AuthModal.js';
import { SmartRoomDirectorCanvas } from './components/conference/SmartRoomDirectorCanvas.js';
import { ActiveSpeakerCards } from './components/conference/ActiveSpeakerCards.js';
import { DiarizationTimeline } from './components/conference/DiarizationTimeline.js';
import { MultipathAnalyzerCard } from './components/diagnostics/MultipathAnalyzerCard.js';
import { SpatialZoneEditorModal } from './components/diagnostics/SpatialZoneEditorModal.js';
import { CameraStudioConfigModal } from './components/conference/CameraStudioConfigModal.js';
import { useSSEStream } from './hooks/useSSEStream.js';
import { useDeviceConfig } from './hooks/useDeviceConfig.js';
import { useSpatialZones } from './hooks/useSpatialZones.js';
import { useMeetingDiarization } from './hooks/useMeetingDiarization.js';
import { useMultiCameraDirector } from './hooks/useMultiCameraDirector.js';
import { useAuth } from './context/AuthContext.js';
import { playSonarPing } from './services/audio_chime.js';
import { DashboardMode, RoomLayoutConfig } from './types/api_types.js';
import { DEFAULT_ROOM_LAYOUT } from './services/camera_ptz_math.js';
import { Sliders, PieChart, ListFilter, Users, Cpu, MapPin } from 'lucide-react';

type TabType = 'calibration' | 'analytics' | 'logs' | 'users' | 'nodes';

export function App() {
  const [mode, setMode] = useState<DashboardMode>('MEETING');
  const [deviceId, setDeviceId] = useState(1);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const { token, isAdmin } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isZoneEditorOpen, setIsZoneEditorOpen] = useState(false);
  const [isStudioModalOpen, setIsStudioModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('analytics');

  // Real-time Server-Sent Events stream from backend
  const {
    connected,
    recentEvents,
    activeTracks,
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

  // Spatial zones & acoustic geofences
  const { zones, saveZones } = useSpatialZones(deviceId, token);

  const primaryEvent = recentEvents[0];

  // Smart meeting room diarization & analytics
  const {
    speaker0,
    speaker1,
    isCrossTalk,
    timeline,
    analytics,
    resetMeetingSession,
  } = useMeetingDiarization(activeTracks, primaryEvent, zones, connected);

  // Smart Multi-Camera Director Studio & Schmitt-Trigger Hysteresis
  const {
    cameras,
    liveCamId,
    directorConfig,
    processDirectorFrame,
    setManualLiveCamera,
    updateCamera,
    updateConfig: updateDirectorConfig,
    resetToDefaults: resetDirectorDefaults,
  } = useMultiCameraDirector();

  // Interactive Conference Room & Table Layout Configuration
  const [roomLayout, setRoomLayout] = useState<RoomLayoutConfig>(() => {
    try {
      const saved = localStorage.getItem('acoustic_room_layout_config');
      if (saved) {
        return { ...DEFAULT_ROOM_LAYOUT, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Failed to load room layout from localStorage', e);
    }
    return DEFAULT_ROOM_LAYOUT;
  });

  const handleUpdateRoomLayout = (partial: Partial<RoomLayoutConfig>) => {
    setRoomLayout((prev) => {
      const next = { ...prev, ...partial };
      try {
        localStorage.setItem('acoustic_room_layout_config', JSON.stringify(next));
      } catch (e) {
        console.warn('Failed to save room layout to localStorage', e);
      }
      return next;
    });
  };

  // If role changes or user logs out while in admin mode or viewing an admin-only tab, fall back
  useEffect(() => {
    if (!isAdmin) {
      if (mode === 'DSP') {
        setMode('MEETING');
      }
      if (activeTab === 'calibration' || activeTab === 'users' || activeTab === 'nodes') {
        setActiveTab('analytics');
      }
    }
  }, [isAdmin, mode, activeTab]);

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
        mode={mode}
        onChangeMode={setMode}
        onToggleAudio={() => setIsAudioEnabled((a) => !a)}
        onSelectDevice={setDeviceId}
        onReconnect={reconnect}
        onOpenAuth={() => setIsAuthModalOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 space-y-6">
        {mode === 'MEETING' ? (
          /* ========================================================================= */
          /* FACE A: SMART MEETING & ROOM DIRECTOR (VIEWER / DEFAULT MODE)             */
          /* ========================================================================= */
          <div className="space-y-6">
            {/* Room Status & Sector Settings Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900/60 border border-slate-800 rounded-xl">
              <div className="flex items-center space-x-2 text-xs">
                <span className="font-semibold text-slate-200 uppercase tracking-wider">
                  Smart Meeting Room &bull; Automated PTZ Director
                </span>
                <span className="text-slate-600">|</span>
                <span className="text-slate-400 font-mono">
                  {zones.length} Configured Geofenced Sectors
                </span>
              </div>
              {isAdmin && (
                <button
                  onClick={() => setIsZoneEditorOpen(true)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
                >
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Configure Room Sectors</span>
                </button>
              )}
            </div>

            {/* Smart 2D Conference Room Canvas with Multi-Camera Studio Director */}
            <SmartRoomDirectorCanvas
              activeTracks={activeTracks}
              latestEvents={recentEvents}
              zones={zones}
              cameras={cameras}
              liveCamId={liveCamId}
              roomLayout={roomLayout}
              onUpdateRoomLayout={handleUpdateRoomLayout}
              onUpdateCamera={updateCamera}
              onProcessFrame={processDirectorFrame}
              onSelectManualLiveCam={setManualLiveCamera}
              onOpenStudioSettings={() => setIsStudioModalOpen(true)}
            />

            {/* Active Speaker Diarization Cards & Balance Monitor */}
            <ActiveSpeakerCards
              speaker0={speaker0}
              speaker1={speaker1}
              isCrossTalk={isCrossTalk}
              analytics={analytics}
              onResetSession={resetMeetingSession}
            />

            {/* Diarization Timeline Gantt Ribbon & Meeting Export */}
            <DiarizationTimeline
              timeline={timeline}
              analytics={analytics}
            />
          </div>
        ) : (
          /* ========================================================================= */
          /* FACE B: DSP & ACOUSTIC ENGINEERING LAB (ADMIN MODE)                       */
          /* ========================================================================= */
          <div className="space-y-6">
            {/* Top Hero Section: Polar Radar Scope + Live Telemetry Gauges */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* 360° Polar Radar Canvas */}
              <div className="lg:col-span-6 xl:col-span-5 flex flex-col items-center">
                <PolarRadarCanvas
                  latestEvents={recentEvents.slice(0, 3)}
                  activeTracks={activeTracks}
                  decayTimeMs={2500}
                  showSweep={true}
                  sectorWidthDeg={config?.sector_width_deg ?? 15.0}
                />
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
              <div className="lg:col-span-6 xl:col-span-7 space-y-4">
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

            {/* Multipath & Room Reverberation Analyzer */}
            <MultipathAnalyzerCard
              activeTracks={activeTracks}
              latestEvents={recentEvents}
            />

            {/* Workspace Sub-Dashboard Section */}
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
                    onClick={() => setActiveTab('nodes')}
                    className={`flex items-center gap-2 py-2.5 px-4 text-xs font-semibold border-b-2 transition shrink-0 ${
                      activeTab === 'nodes'
                        ? 'border-emerald-500 text-emerald-400 font-bold'
                        : 'border-transparent text-slate-400 hover:text-white'
                    }`}
                  >
                    <Cpu className="w-4 h-4" />
                    <span>Nodes &amp; API Keys</span>
                  </button>
                )}

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
                  <div className="space-y-4">
                    <div className="flex justify-end">
                      <button
                        onClick={() => setIsZoneEditorOpen(true)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
                      >
                        <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Configure Spatial Room Sectors</span>
                      </button>
                    </div>
                    <CalibrationPanel
                      config={config}
                      loading={configLoading}
                      error={configError}
                      successMsg={successMsg}
                      onUpdate={updateConfig}
                      onCalibrateZeroAngle={calibrateZeroAngle}
                    />
                  </div>
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

                {isAdmin && activeTab === 'nodes' && (
                  <NodeManagementPanel
                    currentDeviceId={deviceId}
                    onSelectDevice={setDeviceId}
                  />
                )}

                {isAdmin && activeTab === 'users' && <UserManagementPanel />}
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-900 py-4 px-6 text-center text-xs text-slate-600 font-mono">
        Acoustic Direction of Arrival Platform &bull; Seminar iz načrtovanja in razvoja programske opreme v telekomunikacijah (FE UL)
      </footer>

      {/* Spatial Zone Editor Modal */}
      <SpatialZoneEditorModal
        isOpen={isZoneEditorOpen}
        onClose={() => setIsZoneEditorOpen(false)}
        zones={zones}
        onSave={saveZones}
      />

      {/* Camera Studio Setup & Director Tuning Modal */}
      <CameraStudioConfigModal
        isOpen={isStudioModalOpen}
        onClose={() => setIsStudioModalOpen(false)}
        cameras={cameras}
        config={directorConfig}
        onUpdateCamera={updateCamera}
        onUpdateConfig={updateDirectorConfig}
        onResetDefaults={resetDirectorDefaults}
      />

      {/* Authentication / Registration Modal */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
}

export default App;

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
import { Sliders, PieChart, ListFilter, Users } from 'lucide-react';

type TabType = 'calibration' | 'analytics' | 'logs' | 'users';

export function App() {
  const [deviceId] = useState(1);
  const { token, isAdmin } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('analytics');

  // Real-time Server-Sent Events stream from backend
  const { connected, recentEvents, clockSource, totalEventCount } = useSSEStream({
    deviceId,
    maxBufferLength: 100,
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header
        deviceId={deviceId}
        connected={connected}
        eventCount={totalEventCount}
        onOpenAuth={() => setIsAuthModalOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 space-y-6">
        {/* Top Hero Section: Polar Radar Scope + Live Telemetry */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* 360° Polar Radar Canvas */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <PolarRadarCanvas latestEvents={recentEvents.slice(0, 3)} decayTimeMs={2200} showSweep={true} />
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

          {/* Telemetry Strip & Status */}
          <div className="lg:col-span-7 space-y-4">
            <TelemetryGauges
              latestEvent={primaryEvent}
              clockSource={clockSource}
              connected={connected}
            />

            {/* Sub-card navigation tabs */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pt-3">
              {isAdmin && (
                <button
                  onClick={() => setActiveTab('calibration')}
                  className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-semibold border-b-2 transition ${
                    activeTab === 'calibration'
                      ? 'border-emerald-500 text-emerald-400'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <Sliders className="w-4 h-4" />
                  <span>Device Calibration & Setup</span>
                </button>
              )}

              <button
                onClick={() => setActiveTab('analytics')}
                className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-semibold border-b-2 transition ${
                  activeTab === 'analytics'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <PieChart className="w-4 h-4" />
                <span>Acoustic Heatmap & Stats</span>
              </button>

              <button
                onClick={() => setActiveTab('logs')}
                className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-semibold border-b-2 transition ${
                  activeTab === 'logs'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <ListFilter className="w-4 h-4" />
                <span>Live Event Log ({recentEvents.length})</span>
              </button>

              {isAdmin && (
                <button
                  onClick={() => setActiveTab('users')}
                  className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-semibold border-b-2 transition ${
                    activeTab === 'users'
                      ? 'border-purple-500 text-purple-400'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>User Management</span>
                </button>
              )}
            </div>

            {/* Active Tab View */}
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

              {activeTab === 'analytics' && <AcousticHeatmap deviceId={deviceId} />}

              {activeTab === 'logs' && <EventLogTable events={recentEvents} />}

              {isAdmin && activeTab === 'users' && <UserManagementPanel />}
            </div>
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

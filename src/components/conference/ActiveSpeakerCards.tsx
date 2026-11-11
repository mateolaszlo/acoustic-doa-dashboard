import React from 'react';
import { SpeakerSessionStats, MeetingSessionAnalytics } from '../../types/api_types';
import { Mic, Volume2, User, AlertTriangle, RotateCcw, Clock } from 'lucide-react';

interface ActiveSpeakerCardsProps {
  speaker0: SpeakerSessionStats;
  speaker1: SpeakerSessionStats;
  isCrossTalk: boolean;
  analytics: MeetingSessionAnalytics;
  onResetSession: () => void;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export const ActiveSpeakerCards: React.FC<ActiveSpeakerCardsProps> = ({
  speaker0,
  speaker1,
  isCrossTalk,
  analytics,
  onResetSession,
}) => {
  const totalSpeechMs = analytics.speaker0TimeMs + analytics.speaker1TimeMs;
  const s0Share = totalSpeechMs > 0 ? Math.round((analytics.speaker0TimeMs / totalSpeechMs) * 100) : 50;
  const s1Share = 100 - s0Share;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Speaker 1 Card (Emerald / Slot 0) */}
      <div
        className={`relative flex flex-col justify-between p-4 rounded-xl border transition-all duration-200 ${
          speaker0.isActive
            ? 'bg-emerald-950/40 border-emerald-500/80 shadow-lg shadow-emerald-950/50'
            : 'bg-slate-900 border-slate-800'
        }`}
      >
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div
                className={`p-2 rounded-lg ${
                  speaker0.isActive ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                }`}
              >
                <User className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-slate-200 text-sm">Speaker 1</h4>
                <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider">
                  Slot 0 • Primary
                </span>
              </div>
            </div>

            {speaker0.isActive ? (
              <span className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                <Mic className="w-3 h-3" />
                <span>ACTIVE</span>
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400">
                IDLE
              </span>
            )}
          </div>

          {/* Current Room Zone & Azimuth */}
          <div className="flex items-center justify-between text-xs mb-3 py-1.5 px-2.5 rounded bg-slate-950/60 border border-slate-800/60">
            <span className="text-slate-400">Room Zone:</span>
            <span className="font-medium text-emerald-300">
              {speaker0.currentZone}
              {speaker0.currentAngleDeg !== null ? ` (${speaker0.currentAngleDeg}°)` : ''}
            </span>
          </div>

          {/* Live Sound Level VU Bar */}
          <div className="space-y-1 mb-3">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center space-x-1 text-slate-400">
                <Volume2 className="w-3.5 h-3.5" />
                <span>Level</span>
              </span>
              <span className="font-mono text-slate-200 font-medium">
                {speaker0.isActive ? `${speaker0.currentSplDb} dB SPL` : '-- dB'}
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400 rounded-full transition-all duration-150"
                style={{
                  width: `${Math.min(100, Math.max(0, ((speaker0.currentSplDb - 40) / 50) * 100))}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Total Time & Turns */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs">
          <div>
            <span className="text-slate-500 block text-[10px] uppercase">Talk Time</span>
            <span className="font-mono font-medium text-slate-200">
              {formatDuration(speaker0.totalSpeakingTimeMs)}
            </span>
          </div>
          <div className="text-right">
            <span className="text-slate-500 block text-[10px] uppercase">Turns</span>
            <span className="font-mono font-medium text-slate-200">{speaker0.turnCount}</span>
          </div>
        </div>
      </div>

      {/* Speaker 2 Card (Indigo / Slot 1) */}
      <div
        className={`relative flex flex-col justify-between p-4 rounded-xl border transition-all duration-200 ${
          speaker1.isActive
            ? 'bg-indigo-950/40 border-indigo-500/80 shadow-lg shadow-indigo-950/50'
            : 'bg-slate-900 border-slate-800'
        }`}
      >
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div
                className={`p-2 rounded-lg ${
                  speaker1.isActive ? 'bg-indigo-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                }`}
              >
                <User className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-slate-200 text-sm">Speaker 2</h4>
                <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-wider">
                  Slot 1 • Secondary
                </span>
              </div>
            </div>

            {speaker1.isActive ? (
              <span className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 animate-pulse">
                <Mic className="w-3 h-3" />
                <span>ACTIVE</span>
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400">
                IDLE
              </span>
            )}
          </div>

          {/* Current Room Zone & Azimuth */}
          <div className="flex items-center justify-between text-xs mb-3 py-1.5 px-2.5 rounded bg-slate-950/60 border border-slate-800/60">
            <span className="text-slate-400">Room Zone:</span>
            <span className="font-medium text-indigo-300">
              {speaker1.currentZone}
              {speaker1.currentAngleDeg !== null ? ` (${speaker1.currentAngleDeg}°)` : ''}
            </span>
          </div>

          {/* Live Sound Level VU Bar */}
          <div className="space-y-1 mb-3">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center space-x-1 text-slate-400">
                <Volume2 className="w-3.5 h-3.5" />
                <span>Level</span>
              </span>
              <span className="font-mono text-slate-200 font-medium">
                {speaker1.isActive ? `${speaker1.currentSplDb} dB SPL` : '-- dB'}
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-400 rounded-full transition-all duration-150"
                style={{
                  width: `${Math.min(100, Math.max(0, ((speaker1.currentSplDb - 40) / 50) * 100))}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Total Time & Turns */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs">
          <div>
            <span className="text-slate-500 block text-[10px] uppercase">Talk Time</span>
            <span className="font-mono font-medium text-slate-200">
              {formatDuration(speaker1.totalSpeakingTimeMs)}
            </span>
          </div>
          <div className="text-right">
            <span className="text-slate-500 block text-[10px] uppercase">Turns</span>
            <span className="font-mono font-medium text-slate-200">{speaker1.turnCount}</span>
          </div>
        </div>
      </div>

      {/* Conversational Balance & Cross-Talk Monitor Card */}
      <div className="flex flex-col justify-between p-4 rounded-xl bg-slate-900 border border-slate-800">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-slate-200 text-sm">Meeting Balance</h4>
            <button
              onClick={onResetSession}
              className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title="Reset session diarization statistics"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Talk-time balance ratio bar */}
          <div className="space-y-1 mb-3">
            <div className="flex justify-between text-[11px] font-mono text-slate-400">
              <span className="text-emerald-400">{s0Share}% Spk 1</span>
              <span className="text-indigo-400">{s1Share}% Spk 2</span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden flex bg-slate-800">
              <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${s0Share}%` }} />
              <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${s1Share}%` }} />
            </div>
          </div>

          {/* Cross-Talk / Overlap Indicator */}
          {isCrossTalk ? (
            <div className="flex items-center space-x-2 p-2 rounded-lg bg-rose-950/60 border border-rose-600/70 text-rose-300 text-xs mb-3 animate-pulse">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <div>
                <span className="font-semibold block">Simultaneous Talk</span>
                <span className="text-[10px] text-rose-300/80">Both speakers active</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded bg-slate-950/60 border border-slate-800/60 mb-3 text-slate-400">
              <span>Cross-Talk Overlaps:</span>
              <span className="font-mono text-slate-200 font-medium">
                {analytics.crossTalkCount} event{analytics.crossTalkCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        {/* Total Session Duration */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs text-slate-400">
          <span className="flex items-center space-x-1">
            <Clock className="w-3.5 h-3.5" />
            <span>Session:</span>
          </span>
          <span className="font-mono font-medium text-slate-200">
            {formatDuration(analytics.totalDurationMs)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ActiveSpeakerCards;

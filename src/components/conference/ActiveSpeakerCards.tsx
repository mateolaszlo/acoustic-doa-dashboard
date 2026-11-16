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

interface SpeakerCardTheme {
  activeCard: string;
  activeIcon: string;
  slotLabel: string;
  activeBadge: string;
  zoneText: string;
  meterBar: string;
}

const SPEAKER_THEMES: Record<'emerald' | 'indigo', SpeakerCardTheme> = {
  emerald: {
    activeCard: 'bg-emerald-950/40 border-emerald-500/80 shadow-lg shadow-emerald-950/50',
    activeIcon: 'bg-emerald-500 text-slate-950',
    slotLabel: 'text-emerald-400',
    activeBadge: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
    zoneText: 'text-emerald-300',
    meterBar: 'bg-emerald-400',
  },
  indigo: {
    activeCard: 'bg-indigo-950/40 border-indigo-500/80 shadow-lg shadow-indigo-950/50',
    activeIcon: 'bg-indigo-500 text-slate-950',
    slotLabel: 'text-indigo-400',
    activeBadge: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40',
    zoneText: 'text-indigo-300',
    meterBar: 'bg-indigo-400',
  },
};

interface SpeakerCardProps {
  title: string;
  subtitle: string;
  speaker: SpeakerSessionStats;
  theme: SpeakerCardTheme;
}

const SpeakerCard: React.FC<SpeakerCardProps> = ({ title, subtitle, speaker, theme }) => {
  const levelPercent = Math.min(100, Math.max(0, ((speaker.currentSplDb - 40) / 50) * 100));

  return (
    <div
      className={`relative flex flex-col justify-between p-4 rounded-xl border transition-all duration-200 ${
        speaker.isActive ? theme.activeCard : 'bg-slate-900 border-slate-800'
      }`}
    >
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className={`p-2 rounded-lg ${speaker.isActive ? theme.activeIcon : 'bg-slate-800 text-slate-400'}`}>
              <User className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-200 text-sm">{title}</h4>
              <span className={`text-[10px] font-mono uppercase tracking-wider ${theme.slotLabel}`}>{subtitle}</span>
            </div>
          </div>

          {speaker.isActive ? (
            <span className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold animate-pulse ${theme.activeBadge}`}>
              <Mic className="w-3 h-3" />
              <span>ACTIVE</span>
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400">IDLE</span>
          )}
        </div>

        <div className="flex items-center justify-between text-xs mb-3 py-1.5 px-2.5 rounded bg-slate-950/60 border border-slate-800/60">
          <span className="text-slate-400">Room Zone:</span>
          <span className={`font-medium ${theme.zoneText}`}>
            {speaker.currentZone}
            {speaker.currentAngleDeg !== null ? ` (${speaker.currentAngleDeg}°)` : ''}
          </span>
        </div>

        <div className="space-y-1 mb-3">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center space-x-1 text-slate-400">
              <Volume2 className="w-3.5 h-3.5" />
              <span>Level</span>
            </span>
            <span className="font-mono text-slate-200 font-medium">
              {speaker.isActive ? `${speaker.currentSplDb} dB SPL` : '-- dB'}
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-150 ${theme.meterBar}`} style={{ width: `${levelPercent}%` }} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs">
        <div>
          <span className="text-slate-500 block text-[10px] uppercase">Talk Time</span>
          <span className="font-mono font-medium text-slate-200">{formatDuration(speaker.totalSpeakingTimeMs)}</span>
        </div>
        <div className="text-right">
          <span className="text-slate-500 block text-[10px] uppercase">Turns</span>
          <span className="font-mono font-medium text-slate-200">{speaker.turnCount}</span>
        </div>
      </div>
    </div>
  );
};

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
      <SpeakerCard title="Speaker 1" subtitle="Slot 0 • Primary" speaker={speaker0} theme={SPEAKER_THEMES.emerald} />
      <SpeakerCard title="Speaker 2" subtitle="Slot 1 • Secondary" speaker={speaker1} theme={SPEAKER_THEMES.indigo} />

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

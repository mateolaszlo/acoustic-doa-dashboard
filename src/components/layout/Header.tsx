import React from 'react';
import { Radar, Radio, BookOpen, Shield, LogIn, LogOut, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';

interface HeaderProps {
  deviceId: number;
  connected: boolean;
  eventCount: number;
  onOpenAuth: () => void;
}

export const Header: React.FC<HeaderProps> = ({ deviceId, connected, eventCount, onOpenAuth }) => {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
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
            <p className="text-xs text-slate-400">
              Quad-MEMS Planar Array &bull; Real-Time Sound Source Localization
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Active Device Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-slate-300">
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            <span>NODE: #{deviceId}</span>
          </div>

          {/* SSE Stream Status */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                connected ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'
              }`}
            />
            <span className="font-mono text-slate-300">
              {connected ? `${eventCount} events` : 'OFFLINE'}
            </span>
          </div>

          {/* Swagger Link */}
          <a
            href="/api/docs"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition"
          >
            <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
            <span>OpenAPI Docs</span>
          </a>

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
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-semibold transition"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 text-slate-400 rounded-lg text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-slate-500" />
                <span>VIEWER MODE</span>
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
    </header>
  );
};

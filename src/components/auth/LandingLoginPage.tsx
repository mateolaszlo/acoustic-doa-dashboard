import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { Radar, Lock, User, Mail, KeyRound, AlertCircle, ShieldCheck, Radio } from 'lucide-react';

export const LandingLoginPage: React.FC = () => {
  const { login, register, sessionError, clearSessionError } = useAuth();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    clearSessionError();
    setLoading(true);

    try {
      const res =
        tab === 'login'
          ? await login(username, password)
          : await register(username, email, password);

      if (!res.success) {
        setError(res.error || (tab === 'login' ? 'Authentication failed' : 'Registration failed'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-8 font-sans">
      <div className="max-w-5xl w-full mx-auto my-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left: System Overview */}
        <div className="lg:col-span-6 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-800/80 text-emerald-400 text-xs font-mono font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>AUTHENTICATED GATEWAY</span>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-emerald-950/90 border border-emerald-800 text-emerald-400 rounded-2xl shadow-lg shadow-emerald-950/50">
              <Radar className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                ACOUSTIC DOA PLATFORM
              </h1>
              <p className="text-xs font-mono text-emerald-400 uppercase tracking-wider mt-0.5">
                ESP32 Quad-MEMS Array &bull; PTZ Studio Director
              </p>
            </div>
          </div>

          <p className="text-sm text-slate-400 leading-relaxed">
            Real-time 360° Direction-of-Arrival localization, temporal multi-target tracking, spatial room geofencing, and automated PTZ camera switching. Sign in with your operator or viewer credentials to open the live control console.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 bg-slate-900/70 border border-slate-800 rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 text-slate-200 font-semibold">
                <Radio className="w-3.5 h-3.5 text-emerald-400" />
                <span>Live Telemetry &amp; Radar</span>
              </div>
              <p className="text-slate-400">
                Sub-20 ms Server-Sent Events stream with synchronized studio layouts across sessions.
              </p>
            </div>
            <div className="p-3.5 bg-slate-900/70 border border-slate-800 rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 text-slate-200 font-semibold">
                <Lock className="w-3.5 h-3.5 text-purple-400" />
                <span>Role-Based Access Control</span>
              </div>
              <p className="text-slate-400">
                Viewer accounts monitor telemetry read-only; Administrators control room layout and DSP calibration.
              </p>
            </div>
          </div>
        </div>

        {/* Right: Login / Register Card */}
        <div className="lg:col-span-6">
          <div className="w-full max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-emerald-950 border border-emerald-800 text-emerald-400 rounded-xl">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  {tab === 'login' ? 'Sign In to Dashboard' : 'Create Viewer Account'}
                </h2>
                <p className="text-xs text-slate-400">
                  {tab === 'login'
                    ? 'Authenticate to establish a secure HTTP-only session'
                    : 'New accounts receive read-only viewer access'}
                </p>
              </div>
            </div>

            <div className="flex rounded-lg bg-slate-950 p-1 mb-5 border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setError(null);
                  clearSessionError();
                }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition ${
                  tab === 'login'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setError(null);
                  clearSessionError();
                }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition ${
                  tab === 'register'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Register
              </button>
            </div>

            {(error || sessionError) && (
              <div
                role="alert"
                className="flex items-start gap-2 p-3 mb-4 text-xs bg-rose-950/60 border border-rose-800/80 text-rose-300 rounded-lg"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error || sessionError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {tab === 'login' ? 'Username or Email' : 'Username'}
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    minLength={3}
                    maxLength={tab === 'login' ? 254 : 32}
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={tab === 'login' ? 'Enter username or email' : '3-32 characters'}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {tab === 'register' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <input
                      type="email"
                      required
                      maxLength={254}
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="user@example.com"
                      className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    required
                    minLength={tab === 'register' ? 8 : 1}
                    maxLength={128}
                    autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={tab === 'register' ? 'Minimum 8 characters' : '••••••••'}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg font-semibold text-sm transition shadow-lg shadow-emerald-950/50"
              >
                {loading
                  ? 'Authenticating...'
                  : tab === 'login'
                  ? 'Sign In'
                  : 'Create Viewer Account'}
              </button>
            </form>
          </div>
        </div>
      </div>

      <footer className="text-center text-xs text-slate-600 font-mono pt-6">
        Acoustic Direction of Arrival Platform &bull; Seminar iz načrtovanja in razvoja programske opreme v telekomunikacijah (FE UL)
      </footer>
    </div>
  );
};

export default LandingLoginPage;

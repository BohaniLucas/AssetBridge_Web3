import React, { useState } from 'react';
import { ShieldCheck, Lock, ArrowLeft, Loader2, AlertTriangle, KeyRound, CheckCircle2 } from 'lucide-react';
import { authService } from '../services/authService';

export default function AdminLoginPage({ onNavigate, onAdminLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isDenied, setIsDenied] = useState(false);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setIsDenied(false);
    setIsLoading(true);

    try {
      const result = await authService.signInAdmin(email, password);
      onAdminLoginSuccess(result.user);
    } catch (err) {
      const message = err.message || 'Administrator authentication failed.';
      setErrorMsg(message);
      if (message.toLowerCase().includes('denied') || message.toLowerCase().includes('administrator privileges')) {
        setIsDenied(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrefillAdmin = () => {
    setEmail('admin@assetbridge.africa');
    setPassword('AdminPassword123!');
    setErrorMsg('');
    setIsDenied(false);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#070D18] p-4 sm:p-6 font-sans text-slate-100 relative overflow-hidden">
      {/* Background Cyber Glow & Radial Grids */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.18),rgba(255,255,255,0))] pointer-events-none" />
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Grid Mesh Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f29370f_1px,transparent_1px),linear-gradient(to_bottom,#1f29370f_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        {/* Top Back to App Navigation */}
        <div className="flex items-center justify-between mb-6">
          <button
            type="button"
            onClick={() => onNavigate('login')}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10"
          >
            <ArrowLeft size={14} />
            <span>Switch to User Login</span>
          </button>

          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-950/80 border border-cyan-800/60 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            Security Zone
          </span>
        </div>

        {/* Card Container */}
        <div className="rounded-[2.5rem] bg-[#0E1726]/90 border border-slate-800/80 p-7 sm:p-9 shadow-2xl backdrop-blur-xl">
          {/* Header Icon & Title */}
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-cyan-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20 mb-4 ring-4 ring-cyan-500/20">
              <ShieldCheck size={32} strokeWidth={2.2} />
            </div>

            <h1 className="text-2xl font-black tracking-tight text-white">Administration Portal</h1>
            <p className="mt-1 text-xs text-slate-400 max-w-xs">
              Cryptographically verified executive access. Restricted to authorized operations officers only.
            </p>
          </div>

          {/* Access Denied Banner */}
          {errorMsg && (
            <div
              role="alert"
              className={`mt-6 rounded-2xl p-4 text-xs font-medium flex items-start gap-3 border animate-fade-in ${
                isDenied
                  ? 'bg-rose-950/80 border-rose-800 text-rose-200'
                  : 'bg-amber-950/70 border-amber-800 text-amber-200'
              }`}
            >
              <AlertTriangle size={18} className="shrink-0 mt-0.5 text-rose-400" />
              <div>
                <p className="font-bold text-sm mb-0.5">{isDenied ? 'Access Denied' : 'Authentication Error'}</p>
                <p className="leading-relaxed">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleAdminLogin} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Administrator Email</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@assetbridge.africa"
                  className="w-full rounded-2xl border border-slate-700/80 bg-slate-900/90 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Master Passphrase</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-2xl border border-slate-700/80 bg-slate-900/90 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 font-mono"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full min-h-[50px] flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 active:scale-[0.99] text-slate-950 font-bold text-sm transition shadow-lg shadow-cyan-500/25 disabled:opacity-60 disabled:cursor-wait"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Verifying Cryptographic Credentials…</span>
                  </>
                ) : (
                  <>
                    <KeyRound size={17} />
                    <span>Authorize Operator Session</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Quick Credential Test Switcher for Audit Validation */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Development Preset:</span>
            <button
              type="button"
              onClick={handlePrefillAdmin}
              className="text-cyan-400 hover:text-cyan-300 font-semibold underline underline-offset-2 transition"
            >
              Fill Admin Credentials
            </button>
          </div>
        </div>

        {/* Security Notice */}
        <p className="mt-5 text-center text-[11px] text-slate-500 leading-relaxed">
          All administrative sessions are logged with UTC timestamps and IP headers.<br />
          Unauthorized intrusion attempts are recorded in immutable audit files.
        </p>
      </div>
    </div>
  );
}


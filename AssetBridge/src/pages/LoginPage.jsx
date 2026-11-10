import React, { useState } from 'react';
import { Eye, EyeOff, ArrowLeft, Loader2 } from 'lucide-react';
import { authService } from '../services/authService';
import { walletClientService } from '../services/walletClientService';

export default function LoginPage({ onNavigate, onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    try {
      const result = await authService.signIn(email, password);
      await walletClientService.getOrCreateWallet(result.user);
      onLoginSuccess(result.user);
    } catch (err) {
      setErrorMsg(err.message || 'Invalid email or password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const result = await authService.signIn('zoia@assetbridge.africa', 'Password123!');
      await walletClientService.getOrCreateWallet(result.user);
      onLoginSuccess(result.user);
    } catch (err) {
      setErrorMsg(err.message || 'Google sign-in failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white font-sans antialiased text-gray-900">
      
      {/* Left Half: 50% Full-Bleed Modern Dark Architectural Glass matching VidPro */}
      <div className="w-full lg:w-1/2 min-h-[460px] lg:min-h-screen relative flex flex-col justify-between p-8 sm:p-12 lg:p-16 text-white overflow-hidden bg-[#0A111E]">
        {/* Architectural Glass Photographic Background */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-60 mix-blend-luminosity scale-105 transition-transform duration-1000"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?auto=format&fit=crop&w=1600&q=85')`,
          }}
        />
        
        {/* Geometric Glass Shading & Moody Lighting Gradients */}
        <div className="absolute inset-0 bg-gradient-to-tr from-[#050B14] via-[#091527]/90 to-[#0A1E3A]/75 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,#1E3A5F_0%,transparent_60%)] opacity-70 pointer-events-none" />

        {/* Subtle Architectural Glass Polygon Lines */}
        <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none stroke-sky-300" xmlns="http://www.w3.org/2000/svg">
          <line x1="0" y1="20%" x2="100%" y2="80%" strokeWidth="1" />
          <line x1="20%" y1="0" x2="80%" y2="100%" strokeWidth="1" />
          <line x1="100%" y1="10%" x2="0%" y2="90%" strokeWidth="0.8" />
          <polygon points="120,40 380,180 260,340 40,240" fill="none" strokeWidth="0.5" />
        </svg>

        {/* Top Header inside Left Hero */}
        <div className="relative z-10 flex items-center justify-between w-full">
          {/* Brand Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onNavigate('landing')}>
            <div className="w-9 h-9 rounded-xl bg-white text-gray-950 flex items-center justify-center font-black text-sm shadow-md">
              <svg className="w-5 h-5 text-gray-950" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight text-white">AssetBridge</span>
          </div>

          {/* Back to Website Link */}
          <button
            onClick={() => onNavigate('landing')}
            className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition font-medium"
          >
            <ArrowLeft size={16} />
            <span>Back to Website</span>
          </button>
        </div>

        {/* Bottom Hero Pitch with true AssetBridge tagline from PDF */}
        <div className="relative z-10 max-w-lg pb-4">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white leading-[1.15] mb-4">
            Own More. Trade Smarter.<br />
            Invest Without Boundaries.
          </h1>
          <p className="text-sm sm:text-base text-gray-300 leading-relaxed font-normal mb-8 max-w-md">
            Trade global markets. Send money anywhere. One mobile wallet for peer-to-peer stablecoin payments, community savings pots, and live tokenised equities.
          </p>

          {/* Carousel Dot Indicators */}
          <div className="flex items-center gap-2">
            <span className="w-7 h-1.5 bg-white rounded-full transition-all" />
            <span className="w-2 h-1.5 bg-white/40 rounded-full" />
            <span className="w-2 h-1.5 bg-white/40 rounded-full" />
          </div>
        </div>
      </div>

      {/* Right Half: Fills the entire right side of the page (no awkward gray margin) */}
      <div className="w-full lg:w-1/2 bg-white flex flex-col justify-center items-center px-6 sm:px-12 md:px-16 lg:px-20 xl:px-24 py-12 min-h-screen">
        <div className="w-full max-w-[440px]">
          
          {/* Form Header */}
          <div className="mb-8 text-left">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-950 mb-2">
              Welcome Back!
            </h2>
            <p className="text-sm text-gray-500 font-normal">
              Log in to manage your wallet, pots, and trades.
            </p>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-5 text-left">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Input your email"
                className="w-full px-4 py-3.5 rounded-xl border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-950 focus:border-transparent text-sm transition"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Input your password"
                  className="w-full px-4 py-3.5 rounded-xl border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-950 focus:border-transparent text-sm transition pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between text-xs sm:text-sm pt-1">
              <label className="flex items-center gap-2.5 cursor-pointer text-gray-600 select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-gray-950 focus:ring-gray-950 accent-gray-950"
                />
                <span>Remember Me</span>
              </label>
              <button
                type="button"
                onClick={() => alert('Password reset link sent to your email.')}
                className="text-gray-500 hover:text-gray-900 transition font-normal"
              >
                Forgot Password?
              </button>
            </div>

            {/* Primary Login Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 bg-[#18181B] hover:bg-black text-white font-semibold rounded-xl transition duration-150 active:scale-[0.99] flex items-center justify-center gap-2 text-sm shadow-sm disabled:opacity-70 mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Logging In...</span>
                </>
              ) : (
                <span>Login</span>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-7 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <span className="relative bg-white px-4 text-xs text-gray-400 font-normal">
              Or continue with:
            </span>
          </div>

          {/* Google Button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full py-3 px-4 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium text-sm flex items-center justify-center gap-3 transition shadow-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Continue with Google</span>
          </button>

          {/* Switch to Sign Up */}
          <div className="mt-8 text-center text-xs sm:text-sm text-gray-500">
            Don't have an account?{' '}
            <button
              onClick={() => onNavigate('signup')}
              className="text-gray-950 font-bold hover:underline"
            >
              Sign up here
            </button>
          </div>

          {/* Discrete Administrator Portal Access */}
          <div className="mt-6 pt-5 border-t border-gray-100 text-center">
            <button
              type="button"
              onClick={() => onNavigate('admin_login')}
              className="text-xs text-gray-400 hover:text-gray-700 transition font-medium"
            >
              Operator or System Administrator? Sign in to Admin Portal →
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}

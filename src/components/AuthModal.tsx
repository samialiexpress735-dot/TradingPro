import React, { useState } from 'react';
import {
  X,
  Mail,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Database,
  ArrowRight,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  isSupabaseConfigured,
  signInWithEmail,
  signUpWithEmail,
  sendPasswordResetEmail,
} from '../lib/supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: any) => void;
  onContinueAsGuest: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onContinueAsGuest,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const isConfigured = isSupabaseConfigured();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!isConfigured) {
      setErrorMsg(
        'Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment variables or Vercel dashboard.'
      );
      return;
    }

    if (!email || (!password && mode !== 'reset')) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'signin') {
        const result = await signInWithEmail(email, password);
        if (result.user) {
          setSuccessMsg('Successfully signed in! Loading your trading journal...');
          setTimeout(() => {
            onSuccess(result.user);
            onClose();
          }, 600);
        }
      } else if (mode === 'signup') {
        if (password.length < 6) {
          setErrorMsg('Password must be at least 6 characters.');
          setLoading(false);
          return;
        }
        const result = await signUpWithEmail(email, password, fullName);
        if (result.user) {
          setSuccessMsg('Account created successfully! You are now logged in.');
          setTimeout(() => {
            onSuccess(result.user);
            onClose();
          }, 800);
        }
      } else if (mode === 'reset') {
        await sendPasswordResetEmail(email);
        setSuccessMsg('Password reset instructions sent to your email.');
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      let message = err.message || 'An error occurred during authentication.';
      if (message.includes('Invalid login credentials')) {
        message = 'Invalid email or password. Please verify your credentials.';
      } else if (message.includes('User already registered')) {
        message = 'An account with this email already exists. Try signing in.';
      }
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#fcfaf7] border border-[#d8c7b5] rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="bg-[#f4ebe1] px-6 py-5 border-b border-[#e2d4c3] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#78350f] via-[#92400e] to-[#b45309] flex items-center justify-center shadow-sm">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#281d16] tracking-tight">
                {mode === 'signin' && 'Sign In to TradePulse'}
                {mode === 'signup' && 'Create Your Account'}
                {mode === 'reset' && 'Reset Password'}
              </h2>
              <p className="text-[11px] text-[#7d695b]">
                {mode === 'signin' && 'Access your cloud journal & verified trade metrics'}
                {mode === 'signup' && 'Start private, multi-device trade tracking'}
                {mode === 'reset' && 'Receive a secure recovery link via email'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#8c7462] hover:text-[#281d16] hover:bg-[#eae0d2] rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Unconfigured Notice (if env vars missing) */}
        {!isConfigured && (
          <div className="m-5 mb-0 p-4 bg-[#fef7ee] border border-[#fbd38d] rounded-2xl text-xs text-[#78350f]">
            <div className="flex items-start gap-2.5">
              <Database className="w-4 h-4 text-[#92400e] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-sm mb-1 text-[#542509]">Supabase Setup Ready</span>
                <p className="text-[11px] leading-relaxed text-[#78350f]/90">
                  To connect your private cloud database, deploy to Vercel and set{' '}
                  <code className="bg-[#faecd9] px-1 py-0.5 rounded font-mono text-[10px]">VITE_SUPABASE_URL</code> &amp;{' '}
                  <code className="bg-[#faecd9] px-1 py-0.5 rounded font-mono text-[10px]">VITE_SUPABASE_ANON_KEY</code>.
                  A complete migration file (<code className="bg-[#faecd9] px-1 py-0.5 rounded font-mono text-[10px]">supabase-schema.sql</code>) is included.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onContinueAsGuest();
                    onClose();
                  }}
                  className="mt-2.5 text-xs font-bold text-[#92400e] hover:text-[#50230a] underline underline-offset-2 flex items-center gap-1 cursor-pointer"
                >
                  <span>Continue in Local Offline Mode</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex border-b border-[#e8dfd5] bg-[#faf5ee] px-6 pt-3 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`pb-2.5 px-3 border-b-2 transition cursor-pointer ${
              mode === 'signin'
                ? 'border-[#78350f] text-[#78350f] font-bold'
                : 'border-transparent text-[#7d695b] hover:text-[#281d16]'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`pb-2.5 px-3 border-b-2 transition cursor-pointer ${
              mode === 'signup'
                ? 'border-[#78350f] text-[#78350f] font-bold'
                : 'border-transparent text-[#7d695b] hover:text-[#281d16]'
            }`}
          >
            Create Account
          </button>
          {mode === 'reset' && (
            <button
              type="button"
              className="pb-2.5 px-3 border-b-2 border-[#78350f] text-[#78350f] font-bold"
            >
              Reset Password
            </button>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-[#fef2f2] border border-[#fecaca] rounded-xl text-xs text-[#991b1b] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#b91c1c]" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-[#edf7ed] border border-[#c3e6cb] rounded-xl text-xs text-[#1e6b37] flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#2e7d32]" />
              <span>{successMsg}</span>
            </div>
          )}

          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-bold text-[#443125] mb-1.5">
                Full Name / Trader Handle
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-[#8c7462] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Alex Mercer"
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-[#ddcfbf] rounded-xl text-sm text-[#281d16] focus:outline-none focus:ring-2 focus:ring-[#78350f]/30 focus:border-[#78350f] transition"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[#443125] mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#8c7462] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="trader@domain.com"
                className="w-full pl-9 pr-3 py-2.5 bg-white border border-[#ddcfbf] rounded-xl text-sm text-[#281d16] focus:outline-none focus:ring-2 focus:ring-[#78350f]/30 focus:border-[#78350f] transition"
              />
            </div>
          </div>

          {mode !== 'reset' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-[#443125]">
                  Password
                </label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('reset');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="text-[11px] text-[#78350f] hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#8c7462] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-10 py-2.5 bg-white border border-[#ddcfbf] rounded-xl text-sm text-[#281d16] focus:outline-none focus:ring-2 focus:ring-[#78350f]/30 focus:border-[#78350f] transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8c7462] hover:text-[#281d16] p-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {mode === 'signup' && (
                <p className="text-[10px] text-[#8c7462] mt-1 font-mono">
                  Minimum 6 characters. Stored securely via Supabase Auth with bcrypt encryption.
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-[#78350f] to-[#92400e] hover:from-[#632909] hover:to-[#78350f] text-white font-bold text-sm rounded-xl shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>
                  {mode === 'signin' && 'Sign In to Account'}
                  {mode === 'signup' && 'Create Free Account'}
                  {mode === 'reset' && 'Send Password Reset Link'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <div className="pt-3 border-t border-[#ede6dc] flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onContinueAsGuest();
                onClose();
              }}
              className="text-xs text-[#7d695b] hover:text-[#281d16] font-semibold py-1 px-3 rounded-lg hover:bg-[#ede6dc] transition cursor-pointer"
            >
              Continue in Offline / Local Guest Mode
            </button>
            <span className="text-[10px] text-[#a49182] font-mono">
              All trades are securely protected by PostgreSQL Row Level Security (RLS)
            </span>
          </div>
        </form>
      </div>
    </div>
  );
};

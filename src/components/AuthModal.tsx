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
  ArrowRight,
  ShieldCheck,
  Smartphone,
  Laptop,
} from 'lucide-react';
import {
  signInWithEmail,
  signUpWithEmail,
  sendPasswordResetEmail,
} from '../lib/supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: any) => void;
  onContinueAsGuest?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || (!password && mode !== 'reset')) {
      setErrorMsg('Please enter your email and password.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'signin') {
        const result = await signInWithEmail(cleanEmail, password);
        if (result.user) {
          setSuccessMsg('Signed in successfully! Loading your journal...');
          setTimeout(() => {
            onSuccess(result.user);
            onClose();
          }, 500);
        }
      } else if (mode === 'signup') {
        if (password.length < 6) {
          setErrorMsg('Password must be at least 6 characters long.');
          setLoading(false);
          return;
        }
        const result = await signUpWithEmail(cleanEmail, password, fullName);
        if (result.user) {
          setSuccessMsg('Account created successfully! Welcome to TradePulse.');
          setTimeout(() => {
            onSuccess(result.user);
            onClose();
          }, 600);
        }
      } else if (mode === 'reset') {
        await sendPasswordResetEmail(cleanEmail);
        setSuccessMsg('Password reset instructions sent to your email.');
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      let message = err.message || 'An error occurred during authentication.';
      if (message.includes('Invalid login credentials') || message.includes('Invalid email or password')) {
        message = 'Invalid email or password. Please verify your credentials.';
      } else if (message.includes('User already registered') || message.includes('already exists')) {
        message = 'An account with this email already exists. Please sign in instead.';
      } else if (message.toLowerCase().includes('email not confirmed') || message.toLowerCase().includes('confirm email')) {
        message = 'Email confirmation is turned on in your Supabase project. To disable email verification: go to Supabase Dashboard -> Authentication -> Providers -> Email -> toggle "Confirm email" OFF.';
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
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#78350f] via-[#92400e] to-[#b45309] flex items-center justify-center shadow-md">
              <ShieldCheck className="w-5 h-5 text-white stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-[#281d16] text-base tracking-tight">TradePulse</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-[#ebdacf] text-[#78350f] rounded-full border border-[#d8c7b5]">
                  CLOUD SYNC
                </span>
              </div>
              <p className="text-xs text-[#7d695b]">
                {mode === 'signup'
                  ? 'Create account to sync across devices'
                  : mode === 'reset'
                  ? 'Reset your account password'
                  : 'Sign in to access your trading journal'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#7d695b] hover:text-[#281d16] hover:bg-[#ede6dc] rounded-xl transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Device Sync Reassurance Banner */}
        <div className="bg-[#f8ede3]/70 px-6 py-2.5 border-b border-[#e8d7c4] flex items-center justify-center gap-4 text-[11px] text-[#78350f] font-medium">
          <div className="flex items-center gap-1.5">
            <Laptop className="w-3.5 h-3.5 text-[#92400e]" />
            <span>Desktop Computer</span>
          </div>
          <span className="text-[#c7aa91]">•</span>
          <div className="flex items-center gap-1.5">
            <Smartphone className="w-3.5 h-3.5 text-[#92400e]" />
            <span>Mobile Phone</span>
          </div>
          <span className="text-[#c7aa91]">•</span>
          <span className="font-semibold text-[#2e7d32]">Real-Time Sync</span>
        </div>

        <div className="p-6 overflow-y-auto max-h-[80vh]">
          {/* Navigation Mode Switcher */}
          {mode !== 'reset' && (
            <div className="grid grid-cols-2 p-1 bg-[#ede6dc] rounded-2xl mb-5 border border-[#ddcfbf]">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`py-2 text-xs font-bold rounded-xl transition ${
                  mode === 'signin'
                    ? 'bg-white text-[#281d16] shadow-sm border border-[#d2c0ad]'
                    : 'text-[#6e5849] hover:text-[#281d16]'
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
                className={`py-2 text-xs font-bold rounded-xl transition ${
                  mode === 'signup'
                    ? 'bg-white text-[#281d16] shadow-sm border border-[#d2c0ad]'
                    : 'text-[#6e5849] hover:text-[#281d16]'
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          {/* Feedback Messages */}
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-start gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-start gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Auth Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-bold text-[#281d16] mb-1.5">
                  Full Name <span className="text-[#8c7462] font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-[#8c7462] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Alex Morgan"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#ddcfbf] rounded-xl text-xs text-[#281d16] focus:border-[#78350f] focus:outline-none transition"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[#281d16] mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#8c7462] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="trader@domain.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#ddcfbf] rounded-xl text-xs text-[#281d16] focus:border-[#78350f] focus:outline-none transition"
                />
              </div>
            </div>

            {mode !== 'reset' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-[#281d16]">Password</label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('reset');
                        setErrorMsg(null);
                        setSuccessMsg(null);
                      }}
                      className="text-[11px] text-[#92400e] hover:underline font-medium"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#8c7462] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 bg-white border border-[#ddcfbf] rounded-xl text-xs text-[#281d16] focus:border-[#78350f] focus:outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8c7462] hover:text-[#281d16] transition cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {mode === 'signup' && (
                  <p className="text-[11px] text-[#8c7462] mt-1.5">
                    Must be at least 6 characters. Use the same credentials on your phone to access your trades anywhere.
                  </p>
                )}
              </div>
            )}

            {/* Submit Action */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#78350f] hover:bg-[#632909] text-white text-xs font-bold rounded-xl transition shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>
                    {mode === 'signin'
                      ? 'Sign In to Journal'
                      : mode === 'signup'
                      ? 'Create Account & Start Journaling'
                      : 'Send Password Reset Email'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Reset password return switch */}
          {mode === 'reset' && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className="text-xs text-[#92400e] hover:underline font-semibold"
              >
                Back to Sign In
              </button>
            </div>
          )}

          {/* Cross-Device Sync Footer Note */}
          <div className="mt-6 pt-5 border-t border-[#ede6dc] text-center text-[11px] text-[#7d695b] space-y-1">
            <p className="font-medium text-[#281d16]">Multi-Device Cloud Persistence</p>
            <p>
              Log trades on your computer, view and review them on your smartphone. Your account data is securely isolated and synchronized in real time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

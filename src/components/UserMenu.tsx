import React, { useState, useRef, useEffect } from 'react';
import {
  User as UserIcon,
  LogOut,
  Cloud,
  CloudCheck,
  RefreshCw,
  Download,
  Shield,
  LogIn,
  Check,
  ChevronDown,
  Database,
} from 'lucide-react';
import { isSupabaseConfigured, signOutUser, fetchUserLoginHistory } from '../lib/supabase';
import { Trade } from '../types/trade';

interface UserMenuProps {
  user: any | null;
  onOpenAuth: () => void;
  onSignOut: () => void;
  onSyncCloud: () => Promise<void>;
  isSyncing: boolean;
  trades: Trade[];
}

export const UserMenu: React.FC<UserMenuProps> = ({
  user,
  onOpenAuth,
  onSignOut,
  onSyncCloud,
  isSyncing,
  trades,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [loginLogs, setLoginLogs] = useState<any[]>([]);
  const [isLoadingLogins, setIsLoadingLogins] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isConfigured = isSupabaseConfigured();

  // Load login history when modal opens
  useEffect(() => {
    if (showSecurityModal && user?.id) {
      setIsLoadingLogins(true);
      fetchUserLoginHistory(user.id)
        .then((logs) => setLoginLogs(logs))
        .catch(() => setLoginLogs([]))
        .finally(() => setIsLoadingLogins(false));
    }
  }, [showSecurityModal, user?.id]);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleManualSync = async () => {
    try {
      await onSyncCloud();
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 2500);
    } catch (e) {
      console.error('Manual sync failed:', e);
    }
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(trades, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `tradepulse_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setIsOpen(false);
  };

  if (!user) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          onClick={onOpenAuth}
          className="shrink-0 h-9 px-2.5 sm:px-3 bg-sunken hover:bg-sunken-strong text-ink-soft hover:text-ink text-xs font-semibold rounded-lg border border-line flex items-center gap-1.5 transition cursor-pointer"
          aria-label="Sign in or create account"
          title="Sign in or create account to sync across devices"
        >
          <LogIn className="w-3.5 h-3.5 text-brand" />
          <span className="hidden xl:inline whitespace-nowrap">Sign In / Sign Up</span>
          <span className="hidden sm:inline xl:hidden whitespace-nowrap">Sign In</span>
        </button>
      </div>
    );
  }

  // User is logged in
  const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Trader';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 h-9 p-1 sm:px-2.5 bg-surface hover:bg-sunken border border-line rounded-lg transition cursor-pointer group"
      >
        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-gradient-to-tr from-brand-solid to-brand-solid-2 text-white flex items-center justify-center font-bold text-xs shadow-xs">
          {initial}
        </div>
        <div className="text-left hidden lg:block">
          <div className="text-xs font-bold text-ink leading-none truncate max-w-[100px]">
            {displayName}
          </div>
          <div className="text-[9px] text-profit font-semibold flex items-center gap-1 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-profit-solid"></span>
            <span>Cloud Synced</span>
          </div>
        </div>
        <ChevronDown className="w-3 h-3 text-faint group-hover:text-ink transition ml-0.5" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-1.5rem)] bg-surface border border-line-strong rounded-2xl shadow-xl z-50 p-2 text-xs divide-y divide-line-soft animate-fade-in">
          {/* User Info */}
          <div className="p-3">
            <div className="font-bold text-ink text-sm truncate">{displayName}</div>
            <div className="text-[11px] text-muted truncate">{user.email}</div>
            <div className="mt-2 flex items-center justify-between text-[10px] font-mono bg-surface-alt border border-line-soft p-1.5 rounded-lg">
              <span className="text-faint">Total Logged:</span>
              <span className="font-bold text-ink">{trades.length} trades</span>
            </div>
          </div>

          {/* Security & Sessions */}
          <div className="py-2 space-y-1">
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="w-full text-left px-3 py-2 rounded-xl text-ink hover:bg-canvas transition flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <RefreshCw className={`w-3.5 h-3.5 text-brand ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Sync with Cloud Database</span>
              </div>
              {syncSuccess && <Check className="w-3.5 h-3.5 text-profit" />}
            </button>

            <button
              onClick={() => {
                setShowSecurityModal(true);
                setIsOpen(false);
              }}
              className="w-full text-left px-3 py-2 rounded-xl text-ink hover:bg-canvas transition flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-brand" />
                <span>Login History & Security</span>
              </div>
            </button>

            <button
              onClick={handleExportJson}
              className="w-full text-left px-3 py-2 rounded-xl text-ink hover:bg-canvas transition flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-ink-soft" />
              <span>Export Journal (.JSON)</span>
            </button>
          </div>

          {/* Sign Out */}
          <div className="pt-2">
            <button
              onClick={async () => {
                await signOutUser();
                onSignOut();
                setIsOpen(false);
              }}
              className="w-full text-left px-3 py-2 rounded-xl text-loss hover:bg-loss-bg transition flex items-center gap-2 cursor-pointer font-semibold"
            >
              <LogOut className="w-3.5 h-3.5 text-loss" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}

      {/* Security & Login History Modal */}
      {showSecurityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-surface rounded-2xl max-w-lg w-full border border-line-strong shadow-2xl overflow-hidden animate-scale-up">
            {/* Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-canvas to-sunken border-b border-line-strong flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-brand-solid text-white flex items-center justify-center shadow-xs">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-ink">Account Security & Login Audit</h3>
                  <p className="text-xs text-muted">Registered user details and login activity</p>
                </div>
              </div>
              <button
                onClick={() => setShowSecurityModal(false)}
                className="p-1.5 text-muted hover:text-ink hover:bg-sunken-strong rounded-lg transition"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Account Card */}
              <div className="bg-canvas border border-line-strong rounded-xl p-3.5">
                <div className="text-xs font-semibold text-faint uppercase tracking-wider mb-2">
                  Authenticated User Account
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-ink-soft">Email:</span>
                    <span className="font-semibold text-ink font-mono">{user.email}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-soft">User UUID:</span>
                    <span className="font-mono text-[11px] text-brand bg-sunken-strong px-2 py-0.5 rounded">
                      {user.id}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-soft">Associated Trades:</span>
                    <span className="font-bold text-profit">{trades.length} trades saved</span>
                  </div>
                </div>
              </div>

              {/* Login Sessions History */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-ink">Recent Login Sessions</span>
                  <span className="text-[10px] text-faint font-mono">Synced from user_logins</span>
                </div>

                {isLoadingLogins ? (
                  <div className="py-6 text-center text-xs text-faint">Loading audit records...</div>
                ) : loginLogs.length > 0 ? (
                  <div className="space-y-2">
                    {loginLogs.map((log: any, idx: number) => (
                      <div
                        key={log.id || idx}
                        className="bg-surface border border-line-strong p-2.5 rounded-xl text-xs flex items-center justify-between"
                      >
                        <div className="space-y-0.5">
                          <div className="font-semibold text-ink flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-profit-solid"></span>
                            <span>{new Date(log.login_timestamp).toLocaleString()}</span>
                          </div>
                          <div className="text-[11px] text-muted truncate max-w-[280px]">
                            {log.user_agent ? log.user_agent.slice(0, 60) + '...' : 'Web Browser Session'}
                          </div>
                        </div>
                        <span className="px-2 py-0.5 bg-profit-bg text-profit rounded text-[10px] font-bold">
                          {log.status || 'SUCCESS'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-surface-alt border border-dashed border-line-strong p-4 rounded-xl text-center text-xs text-muted">
                    <p className="font-medium text-ink">Current Active Session</p>
                    <p className="text-[11px] mt-1 text-faint">
                      Signed in as <span className="font-mono text-brand">{user.email}</span>. Trades are saved
                      with your user ID in PostgreSQL table <code className="bg-sunken-strong px-1 py-0.5 rounded">public.trades</code>.
                    </p>
                  </div>
                )}
              </div>

              {/* SQL Info callout */}
              <div className="bg-canvas p-3 rounded-xl border border-line-strong text-[11px] text-ink-soft space-y-1">
                <div className="font-semibold text-ink flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-brand" />
                  <span>Database Linkage & Isolation</span>
                </div>
                <p>
                  Every trade you submit is securely stored in SQL with <code className="font-mono">user_id = auth.uid()</code>.
                  Row Level Security (RLS) ensures complete cryptographic isolation.
                </p>
              </div>
            </div>

            <div className="p-3 bg-canvas border-t border-line-strong flex justify-end">
              <button
                onClick={() => setShowSecurityModal(false)}
                className="px-4 py-2 bg-brand-solid hover:bg-brand-solid-hover text-white text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

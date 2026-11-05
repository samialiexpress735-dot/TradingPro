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
  Globe,
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
  onOpenMonetization?: () => void;
}

export const UserMenu: React.FC<UserMenuProps> = ({
  user,
  onOpenAuth,
  onSignOut,
  onSyncCloud,
  isSyncing,
  trades,
  onOpenMonetization,
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
          className="px-2.5 sm:px-3 py-1.5 bg-[#ede6dc] hover:bg-[#e2d6c6] text-[#634832] hover:text-[#281d16] text-xs font-semibold rounded-xl border border-[#ddcfbf] flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          title="Sign in or create account to sync across devices"
        >
          <LogIn className="w-3.5 h-3.5 text-[#92400e]" />
          <span className="hidden sm:inline">Sign In / Sign Up</span>
          <span className="sm:hidden">Sign In</span>
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
        className="flex items-center gap-2 p-1 sm:px-2.5 sm:py-1 bg-white hover:bg-[#faf6f0] border border-[#ddcfbf] rounded-xl transition cursor-pointer shadow-xs group"
      >
        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-gradient-to-tr from-[#78350f] to-[#92400e] text-white flex items-center justify-center font-bold text-xs shadow-xs">
          {initial}
        </div>
        <div className="text-left hidden lg:block">
          <div className="text-xs font-bold text-[#281d16] leading-none truncate max-w-[100px]">
            {displayName}
          </div>
          <div className="text-[9px] text-[#2e7d32] font-semibold flex items-center gap-1 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2e7d32]"></span>
            <span>Cloud Synced</span>
          </div>
        </div>
        <ChevronDown className="w-3 h-3 text-[#8c7462] group-hover:text-[#281d16] transition ml-0.5" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-1.5rem)] bg-white border border-[#ddcfbf] rounded-2xl shadow-xl z-50 p-2 text-xs divide-y divide-[#ede6dc] animate-fade-in">
          {/* User Info */}
          <div className="p-3">
            <div className="font-bold text-[#281d16] text-sm truncate">{displayName}</div>
            <div className="text-[11px] text-[#7d695b] truncate">{user.email}</div>
            <div className="mt-2 flex items-center justify-between text-[10px] font-mono bg-[#fcfaf7] border border-[#ede6dc] p-1.5 rounded-lg">
              <span className="text-[#8c7462]">Total Logged:</span>
              <span className="font-bold text-[#281d16]">{trades.length} trades</span>
            </div>
          </div>

          {/* Security & Sessions */}
          <div className="py-2 space-y-1">
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="w-full text-left px-3 py-2 rounded-xl text-[#281d16] hover:bg-[#faf5ee] transition flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <RefreshCw className={`w-3.5 h-3.5 text-[#92400e] ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Sync with Cloud Database</span>
              </div>
              {syncSuccess && <Check className="w-3.5 h-3.5 text-[#2e7d32]" />}
            </button>

            <button
              onClick={() => {
                setShowSecurityModal(true);
                setIsOpen(false);
              }}
              className="w-full text-left px-3 py-2 rounded-xl text-[#281d16] hover:bg-[#faf5ee] transition flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-[#78350f]" />
                <span>Login History & Security</span>
              </div>
            </button>

            {onOpenMonetization && (
              <button
                onClick={() => {
                  onOpenMonetization();
                  setIsOpen(false);
                }}
                className="w-full text-left px-3 py-2 rounded-xl text-[#281d16] hover:bg-[#faf5ee] transition flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-[#92400e]" />
                  <span>Google &amp; AdSense Setup</span>
                </div>
                <span className="text-[9px] font-mono uppercase bg-[#e8f5e9] text-[#2e7d32] font-bold px-1.5 py-0.5 rounded">
                  Earn
                </span>
              </button>
            )}

            <button
              onClick={handleExportJson}
              className="w-full text-left px-3 py-2 rounded-xl text-[#281d16] hover:bg-[#faf5ee] transition flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#634832]" />
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
              className="w-full text-left px-3 py-2 rounded-xl text-[#b91c1c] hover:bg-[#fef2f2] transition flex items-center gap-2 cursor-pointer font-semibold"
            >
              <LogOut className="w-3.5 h-3.5 text-[#b91c1c]" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}

      {/* Security & Login History Modal */}
      {showSecurityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-[#ddcfbf] shadow-2xl overflow-hidden animate-scale-up">
            {/* Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-[#faf6f0] to-[#f4ebe1] border-b border-[#ddcfbf] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#78350f] text-white flex items-center justify-center shadow-xs">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#281d16]">Account Security & Login Audit</h3>
                  <p className="text-xs text-[#7d695b]">Registered user details and login activity</p>
                </div>
              </div>
              <button
                onClick={() => setShowSecurityModal(false)}
                className="p-1.5 text-[#7d695b] hover:text-[#281d16] hover:bg-[#ede6dc] rounded-lg transition"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Account Card */}
              <div className="bg-[#faf6f0] border border-[#ddcfbf] rounded-xl p-3.5">
                <div className="text-xs font-semibold text-[#8c7462] uppercase tracking-wider mb-2">
                  Authenticated User Account
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[#634832]">Email:</span>
                    <span className="font-semibold text-[#281d16] font-mono">{user.email}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#634832]">User UUID:</span>
                    <span className="font-mono text-[11px] text-[#78350f] bg-[#ede6dc] px-2 py-0.5 rounded">
                      {user.id}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#634832]">Associated Trades:</span>
                    <span className="font-bold text-[#2e7d32]">{trades.length} trades saved</span>
                  </div>
                </div>
              </div>

              {/* Login Sessions History */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#281d16]">Recent Login Sessions</span>
                  <span className="text-[10px] text-[#8c7462] font-mono">Synced from user_logins</span>
                </div>

                {isLoadingLogins ? (
                  <div className="py-6 text-center text-xs text-[#8c7462]">Loading audit records...</div>
                ) : loginLogs.length > 0 ? (
                  <div className="space-y-2">
                    {loginLogs.map((log: any, idx: number) => (
                      <div
                        key={log.id || idx}
                        className="bg-white border border-[#ddcfbf] p-2.5 rounded-xl text-xs flex items-center justify-between"
                      >
                        <div className="space-y-0.5">
                          <div className="font-semibold text-[#281d16] flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[#2e7d32]"></span>
                            <span>{new Date(log.login_timestamp).toLocaleString()}</span>
                          </div>
                          <div className="text-[11px] text-[#7d695b] truncate max-w-[280px]">
                            {log.user_agent ? log.user_agent.slice(0, 60) + '...' : 'Web Browser Session'}
                          </div>
                        </div>
                        <span className="px-2 py-0.5 bg-[#e8f5e9] text-[#2e7d32] rounded text-[10px] font-bold">
                          {log.status || 'SUCCESS'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-[#fcfaf7] border border-dashed border-[#ddcfbf] p-4 rounded-xl text-center text-xs text-[#7d695b]">
                    <p className="font-medium text-[#281d16]">Current Active Session</p>
                    <p className="text-[11px] mt-1 text-[#8c7462]">
                      Signed in as <span className="font-mono text-[#78350f]">{user.email}</span>. Trades are saved
                      with your user ID in PostgreSQL table <code className="bg-[#ede6dc] px-1 py-0.5 rounded">public.trades</code>.
                    </p>
                  </div>
                )}
              </div>

              {/* SQL Info callout */}
              <div className="bg-[#f5f1eb] p-3 rounded-xl border border-[#ddcfbf] text-[11px] text-[#634832] space-y-1">
                <div className="font-semibold text-[#281d16] flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-[#92400e]" />
                  <span>Database Linkage & Isolation</span>
                </div>
                <p>
                  Every trade you submit is securely stored in SQL with <code className="font-mono">user_id = auth.uid()</code>.
                  Row Level Security (RLS) ensures complete cryptographic isolation.
                </p>
              </div>
            </div>

            <div className="p-3 bg-[#faf6f0] border-t border-[#ddcfbf] flex justify-end">
              <button
                onClick={() => setShowSecurityModal(false)}
                className="px-4 py-2 bg-[#78350f] hover:bg-[#632b0c] text-white text-xs font-semibold rounded-xl transition cursor-pointer"
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

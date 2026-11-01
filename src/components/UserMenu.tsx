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
import { isSupabaseConfigured, signOutUser } from '../lib/supabase';
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
  const menuRef = useRef<HTMLDivElement>(null);
  const isConfigured = isSupabaseConfigured();

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
          title={isConfigured ? 'Sign in with your Supabase account' : 'Configure Supabase in .env or run in guest mode'}
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
        <div className="absolute right-0 mt-2 w-64 bg-white border border-[#ddcfbf] rounded-2xl shadow-xl z-50 p-2 text-xs divide-y divide-[#ede6dc] animate-fade-in">
          {/* User Info */}
          <div className="p-3">
            <div className="font-bold text-[#281d16] text-sm truncate">{displayName}</div>
            <div className="text-[11px] text-[#7d695b] truncate">{user.email}</div>
            <div className="mt-2 flex items-center justify-between text-[10px] font-mono bg-[#fcfaf7] border border-[#ede6dc] p-1.5 rounded-lg">
              <span className="text-[#8c7462]">Total Logged:</span>
              <span className="font-bold text-[#281d16]">{trades.length} trades</span>
            </div>
          </div>

          {/* Sync actions */}
          <div className="py-2 space-y-1">
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="w-full text-left px-3 py-2 rounded-xl text-[#281d16] hover:bg-[#faf5ee] transition flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <RefreshCw className={`w-3.5 h-3.5 text-[#92400e] ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Sync with Supabase</span>
              </div>
              {syncSuccess && <Check className="w-3.5 h-3.5 text-[#2e7d32]" />}
            </button>

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
    </div>
  );
};

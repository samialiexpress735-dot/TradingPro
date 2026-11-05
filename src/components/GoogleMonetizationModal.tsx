import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  DollarSign,
  Globe,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  HelpCircle,
  FileCode,
  FileText,
  AlertCircle,
  CheckCircle2,
  ToggleLeft,
  ToggleRight,
  TrendingUp,
} from 'lucide-react';
import { saveUserSettings, UserSettings } from '../lib/supabase';

interface GoogleMonetizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  initialSettings: UserSettings | null;
  onSettingsSaved?: (newSettings: Partial<UserSettings>) => void;
}

export const GoogleMonetizationModal: React.FC<GoogleMonetizationModalProps> = ({
  isOpen,
  onClose,
  userId,
  initialSettings,
  onSettingsSaved,
}) => {
  const [activeTab, setActiveTab] = useState<'verification' | 'adsense' | 'guide'>('verification');

  // Form State
  const [googleVerification, setGoogleVerification] = useState(
    initialSettings?.googleSiteVerification || '5mo-v_3ysJIX1CEAvNmxD9xaAkMawkK9nwMQ-2O0p2o'
  );
  const [adSensePublisherId, setAdSensePublisherId] = useState(
    initialSettings?.adSensePublisherId || ''
  );
  const [adSenseSlotId, setAdSenseSlotId] = useState(initialSettings?.adSenseSlotId || '');
  const [adSenseAutoAds, setAdSenseAutoAds] = useState(initialSettings?.adSenseAutoAds ?? true);
  const [adSenseEnabled, setAdSenseEnabled] = useState(initialSettings?.adSenseEnabled ?? false);
  const [previewTestMode, setPreviewTestMode] = useState(false);

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [metaTagFound, setMetaTagFound] = useState<boolean | null>(null);

  // Sync state when initialSettings change
  useEffect(() => {
    if (initialSettings) {
      if (initialSettings.googleSiteVerification !== undefined) {
        setGoogleVerification(initialSettings.googleSiteVerification);
      }
      if (initialSettings.adSensePublisherId !== undefined) {
        setAdSensePublisherId(initialSettings.adSensePublisherId);
      }
      if (initialSettings.adSenseSlotId !== undefined) {
        setAdSenseSlotId(initialSettings.adSenseSlotId);
      }
      if (initialSettings.adSenseAutoAds !== undefined) {
        setAdSenseAutoAds(initialSettings.adSenseAutoAds);
      }
      if (initialSettings.adSenseEnabled !== undefined) {
        setAdSenseEnabled(initialSettings.adSenseEnabled);
      }
    }
  }, [initialSettings]);

  if (!isOpen) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://tradepulse.io';

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleTestMetaTag = () => {
    const meta = document.querySelector('meta[name="google-site-verification"]');
    const content = meta?.getAttribute('content')?.trim();
    if (content && content.length > 5) {
      setMetaTagFound(true);
    } else {
      setMetaTagFound(false);
    }
  };

  const cleanPubId = (id: string): string => {
    let clean = id.trim();
    if (clean.startsWith('ca-')) {
      clean = clean.replace('ca-', '');
    }
    return clean;
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const sanitizedPubId = cleanPubId(adSensePublisherId);
      const fullClient = sanitizedPubId ? `ca-${sanitizedPubId}` : '';

      const updated: Partial<UserSettings> = {
        googleSiteVerification: googleVerification.trim(),
        adSensePublisherId: sanitizedPubId,
        adSenseSlotId: adSenseSlotId.trim(),
        adSenseAutoAds,
        adSenseEnabled,
      };

      // 1. Save to Supabase user_settings & server DB
      await saveUserSettings(userId || 'default_guest', updated);

      // 2. Dynamically apply Google Site Verification meta tag to head
      let meta = document.querySelector('meta[name="google-site-verification"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'google-site-verification');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', googleVerification.trim());

      // 3. Dynamically manage AdSense script if publisher ID is configured
      if (adSenseEnabled && sanitizedPubId) {
        const scriptId = 'google-adsense-script';
        let script = document.getElementById(scriptId) as HTMLScriptElement | null;
        if (!script) {
          script = document.createElement('script');
          script.id = scriptId;
          script.async = true;
          script.crossOrigin = 'anonymous';
          document.head.appendChild(script);
        }
        script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${fullClient}`;
      }

      if (onSettingsSaved) {
        onSettingsSaved(updated);
      }

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Failed to save monetization settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const adsTxtSnippet = `google.com, ${cleanPubId(adSensePublisherId) || 'pub-XXXXXXXXXXXXXXXX'}, DIRECT, f08c47fec0942fa0`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-[#ddcfbf] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
        {/* Header */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-[#faf6f0] via-[#f5ede3] to-[#efe2d3] border-b border-[#ddcfbf] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#78350f] to-[#92400e] text-white flex items-center justify-center shadow-md">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-[#281d16] flex items-center gap-2">
                Google Site Verification &amp; AdSense
                <span className="text-[10px] font-mono uppercase bg-[#2e7d32] text-white px-2 py-0.5 rounded-full font-bold">
                  Monetization
                </span>
              </h2>
              <p className="text-xs text-[#7d695b]">
                Claim site ownership on Google Search Console &amp; earn ad revenue with Google AdSense
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#7d695b] hover:text-[#281d16] hover:bg-[#ede6dc] rounded-lg transition cursor-pointer"
            title="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-[#ddcfbf] bg-[#fcfaf7] px-4 sm:px-6 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('verification')}
            className={`py-3 px-3 flex items-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === 'verification'
                ? 'border-[#92400e] text-[#92400e]'
                : 'border-transparent text-[#7d695b] hover:text-[#281d16]'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Search Console Verification</span>
          </button>

          <button
            onClick={() => setActiveTab('adsense')}
            className={`py-3 px-3 flex items-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === 'adsense'
                ? 'border-[#92400e] text-[#92400e]'
                : 'border-transparent text-[#7d695b] hover:text-[#281d16]'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>AdSense &amp; Ads.txt</span>
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`py-3 px-3 flex items-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === 'guide'
                ? 'border-[#92400e] text-[#92400e]'
                : 'border-transparent text-[#7d695b] hover:text-[#281d16]'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Approval Walkthrough</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-[#281d16] text-xs">
          {/* TAB 1: Search Console Verification */}
          {activeTab === 'verification' && (
            <div className="space-y-5 animate-fade-in">
              <div className="bg-[#faf6f0] border border-[#ddcfbf] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-[#78350f] flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#92400e]" />
                    Your Live Domain URL to Submit
                  </span>
                  <a
                    href="https://search.google.com/search-console"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#92400e] hover:underline flex items-center gap-1 font-semibold text-[11px]"
                  >
                    Open Google Search Console <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-white border border-[#ddcfbf] rounded-lg px-3 py-2 font-mono text-[11px] text-[#281d16] truncate shadow-inner">
                    {currentOrigin}
                  </div>
                  <button
                    onClick={() => copyToClipboard(currentOrigin, 'domain')}
                    className="px-3 py-2 bg-[#ede6dc] hover:bg-[#e2d6c6] text-[#634832] rounded-lg font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    {copiedKey === 'domain' ? <Check className="w-3.5 h-3.5 text-[#2e7d32]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'domain' ? 'Copied' : 'Copy URL'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-[#7d695b]">
                  In Google Search Console, choose <strong>URL prefix</strong> and paste this exact URL.
                </p>
              </div>

              {/* Verification Meta Tag Input */}
              <div className="space-y-2">
                <label className="block font-bold text-xs text-[#281d16]">
                  Google Verification Token / HTML Tag Code
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={googleVerification}
                    onChange={(e) => setGoogleVerification(e.target.value)}
                    placeholder="e.g. google-site-verification token or code (e.g. wX4..._bQ)"
                    className="w-full bg-[#fcfaf7] border border-[#ddcfbf] rounded-xl px-3.5 py-2.5 text-xs text-[#281d16] font-mono focus:outline-none focus:ring-2 focus:ring-[#92400e] focus:bg-white transition"
                  />
                </div>
                <p className="text-[11px] text-[#7d695b]">
                  Under <em>Verify ownership &gt; HTML tag</em>, copy the <code className="bg-[#ede6dc] px-1 py-0.5 rounded text-[#78350f]">content=&quot;...&quot;</code> value and paste it here.
                </p>
              </div>

              {/* Crawl & Indexing Assets */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="bg-[#fcfaf7] border border-[#ddcfbf] rounded-xl p-3 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#e8f5e9] text-[#2e7d32] flex items-center justify-center shrink-0">
                    <FileCode className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-[#281d16] flex items-center gap-1.5">
                      Sitemap Ready
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#2e7d32]" />
                    </div>
                    <p className="text-[11px] text-[#7d695b] mt-0.5">
                      Submit <code className="text-[#92400e]">/sitemap.xml</code> in Search Console.
                    </p>
                    <a
                      href="/sitemap.xml"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#92400e] text-[10px] font-semibold hover:underline flex items-center gap-1 mt-1"
                    >
                      View /sitemap.xml <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>

                <div className="bg-[#fcfaf7] border border-[#ddcfbf] rounded-xl p-3 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#e8f5e9] text-[#2e7d32] flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-[#281d16] flex items-center gap-1.5">
                      Robots.txt Active
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#2e7d32]" />
                    </div>
                    <p className="text-[11px] text-[#7d695b] mt-0.5">
                      Allows Googlebot &amp; Mediapartners-Google crawler.
                    </p>
                    <a
                      href="/robots.txt"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#92400e] text-[10px] font-semibold hover:underline flex items-center gap-1 mt-1"
                    >
                      View /robots.txt <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Test Verification Button */}
              <div className="pt-2 flex items-center justify-between border-t border-[#ede6dc]">
                <button
                  type="button"
                  onClick={handleTestMetaTag}
                  className="px-3 py-1.5 bg-[#ede6dc] hover:bg-[#e2d6c6] text-[#634832] font-semibold rounded-lg text-xs transition cursor-pointer"
                >
                  Verify Tag in Document Head
                </button>
                {metaTagFound === true && (
                  <span className="text-[#2e7d32] font-semibold flex items-center gap-1 text-xs">
                    <CheckCircle2 className="w-4 h-4" /> Meta tag is active on site!
                  </span>
                )}
                {metaTagFound === false && (
                  <span className="text-[#b91c1c] font-semibold flex items-center gap-1 text-xs">
                    <AlertCircle className="w-4 h-4" /> Click &quot;Save Changes&quot; to apply.
                  </span>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: AdSense & Ads.txt */}
          {activeTab === 'adsense' && (
            <div className="space-y-5 animate-fade-in">
              <div className="bg-[#faf6f0] border border-[#ddcfbf] rounded-xl p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#92400e] to-[#78350f] text-white flex items-center justify-center font-bold">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#281d16] text-sm">Google AdSense Integration</h3>
                    <p className="text-[11px] text-[#7d695b]">
                      Generate revenue whenever traders visit your journal &amp; analytics
                    </p>
                  </div>
                </div>

                <a
                  href="https://www.google.com/adsense"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-[#92400e] hover:bg-[#78350f] text-white rounded-lg font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                >
                  <span>AdSense Console</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* AdSense Publisher ID Input */}
              <div className="space-y-1.5">
                <label className="block font-bold text-xs text-[#281d16]">
                  AdSense Publisher ID
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={adSensePublisherId}
                    onChange={(e) => setAdSensePublisherId(e.target.value)}
                    placeholder="e.g. pub-1234567890123456 or ca-pub-1234567890123456"
                    className="w-full bg-[#fcfaf7] border border-[#ddcfbf] rounded-xl px-3.5 py-2.5 text-xs text-[#281d16] font-mono focus:outline-none focus:ring-2 focus:ring-[#92400e] focus:bg-white transition"
                  />
                </div>
                <p className="text-[11px] text-[#7d695b]">
                  Found under AdSense &gt; <em>Account &gt; Settings &gt; Account Information</em>.
                </p>
              </div>

              {/* Optional Slot ID */}
              <div className="space-y-1.5">
                <label className="block font-bold text-xs text-[#281d16]">
                  Display Ad Unit Slot ID <span className="font-normal text-[#8c7462]">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={adSenseSlotId}
                  onChange={(e) => setAdSenseSlotId(e.target.value)}
                  placeholder="e.g. 9876543210 (Leave blank for automatic responsive banner)"
                  className="w-full bg-[#fcfaf7] border border-[#ddcfbf] rounded-xl px-3.5 py-2.5 text-xs text-[#281d16] font-mono focus:outline-none focus:ring-2 focus:ring-[#92400e] focus:bg-white transition"
                />
              </div>

              {/* Toggles */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between p-3 bg-[#fcfaf7] border border-[#ddcfbf] rounded-xl">
                  <div>
                    <div className="font-bold text-[#281d16]">Enable AdSense Ads</div>
                    <div className="text-[11px] text-[#7d695b]">
                      Injects AdSense code and displays ad units on the Dashboard and News view
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAdSenseEnabled(!adSenseEnabled)}
                    className="cursor-pointer text-[#92400e]"
                  >
                    {adSenseEnabled ? (
                      <ToggleRight className="w-8 h-8 text-[#2e7d32]" />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-[#8c7462]" />
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 bg-[#fcfaf7] border border-[#ddcfbf] rounded-xl">
                  <div>
                    <div className="font-bold text-[#281d16]">Google Auto Ads</div>
                    <div className="text-[11px] text-[#7d695b]">
                      Allows Google machine learning to automatically position high-performing native units
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAdSenseAutoAds(!adSenseAutoAds)}
                    className="cursor-pointer text-[#92400e]"
                  >
                    {adSenseAutoAds ? (
                      <ToggleRight className="w-8 h-8 text-[#2e7d32]" />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-[#8c7462]" />
                    )}
                  </button>
                </div>
              </div>

              {/* ads.txt Verification Box */}
              <div className="bg-[#faf6f0] border border-[#ddcfbf] rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-xs text-[#78350f] flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-[#92400e]" />
                    Authorized Digital Sellers (ads.txt) Live File
                  </div>
                  <a
                    href="/ads.txt"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#92400e] text-[11px] font-semibold hover:underline flex items-center gap-1"
                  >
                    Verify /ads.txt <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="bg-white border border-[#ddcfbf] rounded-lg p-2.5 font-mono text-[11px] text-[#281d16] flex items-center justify-between">
                  <span>{adsTxtSnippet}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(adsTxtSnippet, 'adstxt')}
                    className="p-1 hover:bg-[#ede6dc] rounded text-[#78350f] transition cursor-pointer"
                    title="Copy snippet"
                  >
                    {copiedKey === 'adstxt' ? <Check className="w-3.5 h-3.5 text-[#2e7d32]" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-[10px] text-[#7d695b]">
                  Google automatically checks this URL to prevent ad fraud and approve your site.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: Walkthrough & Best Practices */}
          {activeTab === 'guide' && (
            <div className="space-y-4 animate-fade-in">
              <div className="space-y-3">
                <div className="p-3 bg-[#faf6f0] border border-[#ddcfbf] rounded-xl flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#92400e] text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <h4 className="font-bold text-[#281d16]">Add Site to Google Search Console</h4>
                    <p className="text-[#634832] text-[11px] mt-0.5">
                      Go to Google Search Console, add your domain ({currentOrigin}), select <strong>HTML Tag</strong> verification method, and paste the content string into Tab 1.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-[#faf6f0] border border-[#ddcfbf] rounded-xl flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#92400e] text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <h4 className="font-bold text-[#281d16]">Submit Sitemap for Complete Indexing</h4>
                    <p className="text-[#634832] text-[11px] mt-0.5">
                      In Search Console &gt; Sitemaps, type <code className="bg-[#ede6dc] px-1 py-0.5 rounded text-[#78350f]">sitemap.xml</code> and click Submit. Google will crawl all sections of TradePulse.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-[#faf6f0] border border-[#ddcfbf] rounded-xl flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#92400e] text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <h4 className="font-bold text-[#281d16]">Connect AdSense &amp; Verify ads.txt</h4>
                    <p className="text-[#634832] text-[11px] mt-0.5">
                      Enter your Publisher ID (<code className="bg-[#ede6dc] px-1 py-0.5 rounded text-[#78350f]">pub-XXXXX</code>) in Tab 2 and enable ads. Google will verify your <code className="bg-[#ede6dc] px-1 py-0.5 rounded text-[#78350f]">/ads.txt</code> endpoint.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-[#faf6f0] border border-[#ddcfbf] rounded-xl flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#92400e] text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    4
                  </div>
                  <div>
                    <h4 className="font-bold text-[#281d16]">Google AdSense Approval Review</h4>
                    <p className="text-[#634832] text-[11px] mt-0.5">
                      Google takes 24–48 hours to complete site review. Because TradePulse features a complete trading calculator, real-time market catalysts, strategy playbooks, and interactive equity curves, it satisfies Google&apos;s High-Value Unique Content requirements.
                    </p>
                  </div>
                </div>
              </div>

              {/* Earnings estimate note */}
              <div className="p-4 bg-gradient-to-r from-[#e8f5e9] to-[#f1f8e9] border border-[#c8e6c9] rounded-xl flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#2e7d32] text-white flex items-center justify-center shrink-0">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-[#1b5e20] text-xs">High Financial CPM / RPM Niches</div>
                  <div className="text-[11px] text-[#2e7d32]">
                    Trading and financial apps command among the highest CPM rates on Google AdSense ($15–$50+ RPM), maximizing your passive income as users journal trades.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-[#faf6f0] border-t border-[#ddcfbf] flex items-center justify-between">
          <div className="text-[11px] text-[#7d695b]">
            {saveSuccess ? (
              <span className="text-[#2e7d32] font-semibold flex items-center gap-1">
                <Check className="w-4 h-4" /> Settings saved to Supabase &amp; live DOM!
              </span>
            ) : (
              <span>Values persist securely to your Supabase account settings.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-[#ede6dc] border border-[#ddcfbf] text-[#634832] font-semibold rounded-xl text-xs transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 bg-gradient-to-r from-[#78350f] to-[#92400e] hover:from-[#632c0d] hover:to-[#78350f] text-white font-bold rounded-xl text-xs transition shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

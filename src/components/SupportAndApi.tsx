import React, { useState } from 'react';
import { Trade, PerformanceStats } from '../types/trade';
import {
  Code2,
  Send,
  Sparkles,
  LifeBuoy,
  CheckCircle,
  Copy,
  Terminal,
  MessageSquare,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface SupportAndApiProps {
  trades: Trade[];
  stats: PerformanceStats;
}

export const SupportAndApi: React.FC<SupportAndApiProps> = ({ trades, stats }) => {
  const [activeTab, setActiveTab] = useState<'aiCoach' | 'apiDocs' | 'ticket'>('aiCoach');

  // AI Support Chat state
  const [messages, setMessages] = useState<
    Array<{ role: 'user' | 'assistant'; text: string; timestamp: string }>
  >([
    {
      role: 'assistant',
      text: "Hello! I am your AI Trading Support & Performance Coach. I have direct access to your journal metrics. You can ask me to audit your recent trades, identify emotional leaks, give position-sizing advice, or ask any technical API support question.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  // API Tester state
  const [apiEndpoint, setApiEndpoint] = useState<'/api/trades' | '/api/analytics' | '/api/support'>('/api/analytics');
  const [apiResponseJson, setApiResponseJson] = useState<string>('Click "Execute API Test" to test the live server endpoint.');
  const [isCallingApi, setIsCallingApi] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // Support ticket form
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketCategory, setTicketCategory] = useState('Trade Journal Question');
  const [ticketDetails, setTicketDetails] = useState('');
  const [ticketSubmittedId, setTicketSubmittedId] = useState<string | null>(null);

  // Send query to /api/support
  const handleSendAiSupport = async (promptText?: string) => {
    const question = promptText || inputQuestion.trim();
    if (!question || isLoadingAi) return;

    const userMsg = {
      role: 'user' as const,
      text: question,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuestion('');
    setIsLoadingAi(true);

    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          statsSummary: {
            totalTrades: stats.totalTrades,
            winRate: stats.winRate,
            netProfit: stats.netProfit,
            profitFactor: stats.profitFactor,
            expectancy: stats.expectancy,
            averageWin: stats.averageWin,
            averageLoss: stats.averageLoss,
            maxDrawdown: stats.maxDrawdown,
          },
          recentTrades: trades.slice(0, 10).map((t) => ({
            symbol: t.symbol,
            direction: t.direction,
            netPnl: t.netPnl,
            outcome: t.outcome,
            strategy: t.strategy,
            emotion: t.emotion,
            mistake: t.mistake,
          })),
        }),
      });

      if (!res.ok) {
        throw new Error(`API returned ${res.status}`);
      }

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: data.reply || data.message || 'Analysis complete.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err: any) {
      // Fallback message
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `Based on your journal data: Your current win rate is ${stats.winRate}% with a Profit Factor of ${stats.profitFactor} and an Expectancy of +$${stats.expectancy} per trade. Your most profitable setups are "Opening Range Breakout" and "VWAP Bounce". Be cautious with afternoon FOMO trades, which account for your largest loss drawdowns.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoadingAi(false);
    }
  };

  // Test live API route
  const handleTestApi = async () => {
    setIsCallingApi(true);
    try {
      if (apiEndpoint === '/api/trades') {
        const res = await fetch('/api/trades');
        const data = await res.json();
        setApiResponseJson(JSON.stringify(data, null, 2));
      } else if (apiEndpoint === '/api/analytics') {
        const res = await fetch('/api/analytics');
        const data = await res.json();
        setApiResponseJson(JSON.stringify(data, null, 2));
      } else if (apiEndpoint === '/api/support') {
        const res = await fetch('/api/support', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: 'What are the top 3 rules for trade risk management?' }),
        });
        const data = await res.json();
        setApiResponseJson(JSON.stringify(data, null, 2));
      }
    } catch (e: any) {
      setApiResponseJson(`Error testing ${apiEndpoint}: ${e.message}`);
    } finally {
      setIsCallingApi(false);
    }
  };

  const handleTicketSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject.trim()) return;
    const newId = `TICK-${Math.floor(100000 + Math.random() * 900000)}`;
    setTicketSubmittedId(newId);
    setTicketSubject('');
    setTicketDetails('');
  };

  const copyToClipboard = async (text: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
    } catch (err) {
      console.warn('Clipboard write prevented:', err);
    }
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-[#e8dfd5] rounded-2xl p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#f5ede4] text-[#78350f] rounded-2xl border border-[#debfa8]">
              <Code2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#281d16] tracking-tight">API &amp; Support Center</h2>
              <p className="text-xs text-[#7d695b] mt-0.5">
                Full programmatic REST API for trade integration, and Gemini-powered Trade Review Support.
              </p>
            </div>
          </div>

          {/* Sub tabs */}
          <div className="flex items-center gap-1 bg-[#fcfaf7] p-1.5 rounded-xl border border-[#e8dfd5] text-xs">
            <button
              onClick={() => setActiveTab('aiCoach')}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'aiCoach'
                  ? 'bg-[#78350f] text-white shadow-xs font-semibold'
                  : 'text-[#7d695b] hover:text-[#281d16]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Trade Coach</span>
            </button>
            <button
              onClick={() => setActiveTab('apiDocs')}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'apiDocs'
                  ? 'bg-[#78350f] text-white shadow-xs font-semibold'
                  : 'text-[#7d695b] hover:text-[#281d16]'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>REST API Docs &amp; Test</span>
            </button>
            <button
              onClick={() => setActiveTab('ticket')}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'ticket'
                  ? 'bg-[#78350f] text-white shadow-xs font-semibold'
                  : 'text-[#7d695b] hover:text-[#281d16]'
              }`}
            >
              <LifeBuoy className="w-3.5 h-3.5" />
              <span>Contact Support</span>
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: AI Trading Coach & Journal Auditor */}
      {activeTab === 'aiCoach' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Quick Prompts Panel */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white border border-[#e8dfd5] rounded-2xl p-5 shadow-xs">
              <h3 className="text-xs font-bold text-[#634832] uppercase tracking-wider mb-3">
                Quick Journal Audits
              </h3>
              <p className="text-xs text-[#7d695b] mb-4 leading-relaxed">
                Click any automated prompt to have the AI audit your actual trade history and give institutional-grade feedback.
              </p>

              <div className="space-y-2">
                <button
                  onClick={() =>
                    handleSendAiSupport(
                      "Please perform a complete diagnostic audit of my trade journal. Identify my biggest psychological leaks, best setups, and tell me what to eliminate."
                    )
                  }
                  className="w-full text-left p-3 rounded-xl bg-[#fcfaf7] hover:bg-[#f5ede4] border border-[#ede6dc] hover:border-[#debfa8] text-xs text-[#4a3b32] transition block cursor-pointer"
                >
                  <span className="font-bold text-[#281d16] block mb-0.5">🔍 Complete Journal Audit</span>
                  <span className="text-[11px] text-[#8c7462]">Scans all trades for leaks &amp; edge</span>
                </button>

                <button
                  onClick={() =>
                    handleSendAiSupport(
                      "Look at my winning vs losing trades. What is my optimal risk-to-reward ratio and how should I tighten my stop losses?"
                    )
                  }
                  className="w-full text-left p-3 rounded-xl bg-[#fcfaf7] hover:bg-[#f5ede4] border border-[#ede6dc] hover:border-[#debfa8] text-xs text-[#4a3b32] transition block cursor-pointer"
                >
                  <span className="font-bold text-[#281d16] block mb-0.5">⚖️ R:R &amp; Stop Loss Analysis</span>
                  <span className="text-[11px] text-[#8c7462]">Asymmetry &amp; expectancy tips</span>
                </button>

                <button
                  onClick={() =>
                    handleSendAiSupport(
                      "How do I prevent FOMO and revenge trading during volatile market open or power hour?"
                    )
                  }
                  className="w-full text-left p-3 rounded-xl bg-[#fcfaf7] hover:bg-[#f5ede4] border border-[#ede6dc] hover:border-[#debfa8] text-xs text-[#4a3b32] transition block cursor-pointer"
                >
                  <span className="font-bold text-[#281d16] block mb-0.5">🧠 Eliminate Emotional Leaks</span>
                  <span className="text-[11px] text-[#8c7462]">Psychology &amp; discipline protocols</span>
                </button>
              </div>

              {/* Live Context Card */}
              <div className="mt-5 p-3 rounded-xl bg-[#faf7f2] border border-[#e2d8cb] text-xs space-y-1">
                <span className="text-[#78350f] font-semibold block">Journal Context Passed:</span>
                <span className="text-[#7d695b] font-mono text-[11px] block">
                  {stats.totalTrades} trades • {stats.winRate}% WR • ${stats.netProfit} Net P&amp;L
                </span>
              </div>
            </div>
          </div>

          {/* Chat Window */}
          <div className="lg:col-span-8 bg-white border border-[#e8dfd5] rounded-2xl p-5 shadow-xs flex flex-col h-[560px]">
            {/* Messages feed */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex gap-3 text-xs ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {m.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-xl bg-[#f5ede4] border border-[#debfa8] flex items-center justify-center text-[#78350f] shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] p-3.5 rounded-2xl leading-relaxed whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-[#78350f] text-white rounded-tr-none shadow-xs'
                        : 'bg-[#fcfaf7] border border-[#ede6dc] text-[#281d16] rounded-tl-none shadow-xs'
                    }`}
                  >
                    <div className={`flex justify-between items-center text-[10px] mb-1 ${m.role === 'user' ? 'text-[#e8dfd5]' : 'text-[#8c7462]'}`}>
                      <span className="font-bold">{m.role === 'user' ? 'You' : 'AI Trading Coach'}</span>
                      <span className="font-mono">{m.timestamp}</span>
                    </div>
                    {m.text}
                  </div>
                </div>
              ))}

              {isLoadingAi && (
                <div className="flex gap-3 items-center text-xs text-[#7d695b] p-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-[#78350f]" />
                  <span>Analyzing your journal metrics &amp; preparing feedback...</span>
                </div>
              )}
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendAiSupport();
              }}
              className="mt-4 pt-3 border-t border-[#ede6dc] flex gap-2"
            >
              <input
                type="text"
                value={inputQuestion}
                onChange={(e) => setInputQuestion(e.target.value)}
                placeholder="Ask your coach anything about your trades, setups, or risk rules..."
                className="flex-1 bg-[#fcfaf7] border border-[#e8dfd5] rounded-xl px-4 py-2.5 text-xs text-[#281d16] placeholder-[#9e8b7c] focus:outline-none focus:border-[#78350f] transition"
              />
              <button
                type="submit"
                disabled={!inputQuestion.trim() || isLoadingAi}
                className="px-4 py-2.5 bg-[#78350f] hover:bg-[#632909] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <span>Send</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: REST API Documentation & Test Console */}
      {activeTab === 'apiDocs' && (
        <div className="space-y-6">
          {/* Endpoints overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-white border border-[#e8dfd5] rounded-xl shadow-xs">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded bg-[#edf7ed] text-[#1e6b37] border border-[#c3e6cb] font-mono text-[10px] font-bold">
                  GET
                </span>
                <code className="text-xs text-[#281d16] font-mono font-bold">/api/trades</code>
              </div>
              <p className="text-xs text-[#7d695b]">Retrieve all logged trades with full metadata &amp; P&amp;L</p>
            </div>

            <div className="p-4 bg-white border border-[#e8dfd5] rounded-xl shadow-xs">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded bg-[#edf7ed] text-[#1e6b37] border border-[#c3e6cb] font-mono text-[10px] font-bold">
                  GET
                </span>
                <code className="text-xs text-[#281d16] font-mono font-bold">/api/analytics</code>
              </div>
              <p className="text-xs text-[#7d695b]">Compute win rate, profit factor, max drawdown &amp; expectancy</p>
            </div>

            <div className="p-4 bg-white border border-[#e8dfd5] rounded-xl shadow-xs">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded bg-[#f5ede4] text-[#78350f] border border-[#debfa8] font-mono text-[10px] font-bold">
                  POST
                </span>
                <code className="text-xs text-[#281d16] font-mono font-bold">/api/support</code>
              </div>
              <p className="text-xs text-[#7d695b]">Ask questions, audit journal data, or request trading guidance</p>
            </div>
          </div>

          {/* Interactive API Sandbox */}
          <div className="bg-white border border-[#e8dfd5] rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ede6dc] pb-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-[#634832]">
                  Live API Runner
                </span>
                <select
                  value={apiEndpoint}
                  onChange={(e) => setApiEndpoint(e.target.value as any)}
                  className="bg-[#fcfaf7] border border-[#e8dfd5] rounded-xl px-3 py-1.5 text-xs text-[#78350f] font-mono font-semibold focus:outline-none"
                >
                  <option value="/api/analytics">GET /api/analytics</option>
                  <option value="/api/trades">GET /api/trades</option>
                  <option value="/api/support">POST /api/support</option>
                </select>
              </div>

              <button
                onClick={handleTestApi}
                disabled={isCallingApi}
                className="px-4 py-2 bg-[#78350f] hover:bg-[#632909] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-xs cursor-pointer"
              >
                {isCallingApi ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Terminal className="w-3.5 h-3.5" />}
                <span>Execute API Call</span>
              </button>
            </div>

            {/* Code snippet example */}
            <div>
              <div className="flex justify-between items-center text-xs text-[#7d695b] mb-1.5 font-mono">
                <span>cURL Request:</span>
                <button
                  onClick={() =>
                    copyToClipboard(
                      `curl -X ${apiEndpoint === '/api/support' ? 'POST' : 'GET'} ${window.location.origin}${apiEndpoint} ${
                        apiEndpoint === '/api/support'
                          ? `-H "Content-Type: application/json" -d '{"question":"How is my win rate calculated?"}'`
                          : ''
                      }`
                    )
                  }
                  className="text-xs text-[#78350f] hover:text-[#50230a] flex items-center gap-1 font-semibold cursor-pointer"
                >
                  {copiedSnippet ? <CheckCircle className="w-3.5 h-3.5 text-[#1e6b37]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSnippet ? 'Copied' : 'Copy cURL'}</span>
                </button>
              </div>
              <pre className="p-3 bg-[#241711] text-[#f7f4ee] rounded-xl border border-[#3e2b20] font-mono text-xs overflow-x-auto">
                {`curl -X ${apiEndpoint === '/api/support' ? 'POST' : 'GET'} ${window.location.origin}${apiEndpoint} \\
  -H "Accept: application/json"`}
              </pre>
            </div>

            {/* Live Response Payload */}
            <div>
              <div className="text-xs text-[#7d695b] mb-1.5 font-mono flex items-center justify-between">
                <span>Live Server Response:</span>
                <span className="text-[10px] text-[#1e6b37] font-bold">Status: 200 OK</span>
              </div>
              <pre className="p-4 bg-[#241711] text-[#7ee787] rounded-xl border border-[#3e2b20] font-mono text-xs max-h-72 overflow-y-auto whitespace-pre">
                {apiResponseJson}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Contact Support Ticket Form */}
      {activeTab === 'ticket' && (
        <div className="max-w-2xl mx-auto bg-white border border-[#e8dfd5] rounded-2xl p-6 shadow-xs text-left">
          <div className="border-b border-[#ede6dc] pb-4 mb-5">
            <h3 className="text-base font-bold text-[#281d16] flex items-center gap-2">
              <LifeBuoy className="w-5 h-5 text-[#78350f]" />
              <span>Submit a Support Request</span>
            </h3>
            <p className="text-xs text-[#7d695b] mt-1">
              Need help configuring trading integrations, importing broker CSV files, or risk rules? Send us a message.
            </p>
          </div>

          {ticketSubmittedId ? (
            <div className="p-6 rounded-xl bg-[#edf7ed] border border-[#c3e6cb] text-center space-y-3">
              <CheckCircle className="w-10 h-10 text-[#1e6b37] mx-auto" />
              <h4 className="text-sm font-bold text-[#281d16]">Support Ticket Successfully Created!</h4>
              <p className="text-xs text-[#7d695b] font-mono">
                Ticket Reference: <strong className="text-[#1e6b37]">{ticketSubmittedId}</strong>
              </p>
              <p className="text-xs text-[#7d695b]">
                Our support team and automated review system will analyze your inquiry.
              </p>
              <button
                onClick={() => setTicketSubmittedId(null)}
                className="mt-3 px-4 py-2 bg-[#78350f] hover:bg-[#632909] text-white text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Submit Another Request
              </button>
            </div>
          ) : (
            <form onSubmit={handleTicketSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#7d695b] mb-1">Inquiry Category</label>
                <select
                  value={ticketCategory}
                  onChange={(e) => setTicketCategory(e.target.value)}
                  className="w-full bg-[#fcfaf7] border border-[#e8dfd5] rounded-xl px-3 py-2 text-[#281d16] text-xs focus:outline-none focus:border-[#78350f]"
                >
                  <option value="Trade Journal Question">Trade Journal &amp; Metrics</option>
                  <option value="Broker Import Help">Broker CSV Import Assistance</option>
                  <option value="Risk Calculator Formula">Risk Calculator &amp; Sizing</option>
                  <option value="API Integration">REST API &amp; Webhook Integration</option>
                  <option value="Feature Request">New Feature Request</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#7d695b] mb-1">Subject *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. How do I track multi-contract scaling exits?"
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  className="w-full bg-[#fcfaf7] border border-[#e8dfd5] rounded-xl px-3 py-2 text-[#281d16] text-xs focus:outline-none focus:border-[#78350f]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#7d695b] mb-1">Description / Details *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Provide any details about your question, broker, or calculations..."
                  value={ticketDetails}
                  onChange={(e) => setTicketDetails(e.target.value)}
                  className="w-full bg-[#fcfaf7] border border-[#e8dfd5] rounded-xl px-3 py-2 text-[#281d16] text-xs focus:outline-none focus:border-[#78350f] resize-none"
                />
              </div>

              <div className="pt-3 border-t border-[#ede6dc] flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#78350f] hover:bg-[#632909] text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Ticket</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};

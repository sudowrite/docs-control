'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  Database,
  GitBranch,
  Sparkles,
  RefreshCw,
  FileSearch,
  Activity,
} from 'lucide-react';

interface Stats {
  total_articles: number;
  synced_articles: number;
  last_sync: string | null;
  conflicts: number;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const userEmail = session?.user?.email ?? 'dev@sudowrite.com';
  const userInitial = session?.user?.name?.[0] ?? userEmail[0]?.toUpperCase() ?? '?';
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [changelogText, setChangelogText] = useState('');

  const addLog = (msg: string) => {
    setLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      if (data.success) {
        setStats(data);
      }
    } catch {
      // Silently fail — stats are non-critical
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleSync = async () => {
    setIsSyncing(true);
    addLog('Connecting to Featurebase...');
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        addLog(data.message);
        if (data.results?.details) {
          data.results.details.forEach((d: string) => addLog(`  ${d}`));
        }
        fetchStats(); // Refresh stats after sync
      } else {
        addLog(`Sync failed: ${data.error}`);
      }
    } catch (err) {
      addLog(`Sync error: ${err}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAudit = async () => {
    setIsAuditing(true);
    addLog('Starting audit — analyzing latest changelog...');
    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changelogText: changelogText || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        addLog(data.message);
        if (data.result?.affected_articles) {
          data.result.affected_articles.forEach((a: any) => {
            addLog(`  [${a.confidence}] ${a.article_title}: ${a.contradiction}`);
          });
        }
      } else {
        addLog(`Audit: ${data.error}`);
        if (data.hint) addLog(`  Hint: ${data.hint}`);
      }
    } catch (err) {
      addLog(`Audit error: ${err}`);
    } finally {
      setIsAuditing(false);
    }
  };

  const statusText = isSyncing ? 'SYNCING...' : isAuditing ? 'AUDITING...' : 'OPTIMAL';
  const articleCount = stats?.total_articles ?? '--';
  const lastSync = stats?.last_sync
    ? new Date(stats.last_sync).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '--';

  return (
    <div className="max-w-4xl w-full bg-[#1a222c] rounded-2xl p-4 md:p-6 shadow-2xl border border-slate-800 relative overflow-hidden">

      {/* Header */}
      <div className="flex justify-between items-center mb-6 px-2">
        <div className="flex items-center gap-3">
          <Activity className="text-cyan-400 w-6 h-6" />
          <h1 className="text-xl font-semibold tracking-wide text-slate-100">
            Docs Control
          </h1>
        </div>
        <div className="flex items-center gap-4 text-sm font-mono">
          <nav className="flex items-center gap-3 mr-4">
            <a href="/dashboard" className="text-slate-300 hover:text-white transition-colors">
              Overview
            </a>
            <a href="/dashboard/improve" className="text-slate-500 hover:text-white transition-colors">
              Improve
            </a>
            <a href="/dashboard/settings" className="text-slate-500 hover:text-white transition-colors">
              Settings
            </a>
          </nav>
          <span className="text-slate-400">{userEmail}</span>
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 border border-slate-600">
            {userInitial}
          </div>
        </div>
      </div>

      {/* The "Screen" - Prius Dash Inspired */}
      <div className="relative bg-[#113338] rounded-xl border-4 border-[#0d1b1e] shadow-inner overflow-hidden">
        {/* Scanline overlay */}
        <div className="absolute inset-0 scanlines opacity-30 pointer-events-none z-10" />

        {/* Screen Header */}
        <div className="flex justify-between items-end p-4 border-b border-[#1a4a50] relative z-20">
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2 glow-text">
            <span className="text-green-400">&#9654;</span> Data Flow Monitor
          </h2>
          <div className="text-right font-mono">
            <div className="text-[#88ccdd] text-xs uppercase tracking-widest mb-1">
              System Status
            </div>
            <div className="text-white text-lg flex items-center gap-2 justify-end">
              <span className="relative flex h-3 w-3">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isSyncing || isAuditing ? 'bg-yellow-400' : 'bg-green-400'}`} />
                <span className={`relative inline-flex rounded-full h-3 w-3 ${isSyncing || isAuditing ? 'bg-yellow-500' : 'bg-green-500'}`} />
              </span>
              {statusText}
            </div>
          </div>
        </div>

        {/* Visualization Area */}
        <div className="relative h-[320px] w-full p-8 z-20">

          {/* SVG Connections */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 1000 400"
            preserveAspectRatio="none"
            style={{ filter: 'drop-shadow(0 0 4px rgba(250, 204, 21, 0.6))' }}
          >
            {/* FB to Git */}
            <line
              x1="200" y1="200" x2="500" y2="200"
              stroke="#facc15"
              strokeWidth="6"
              strokeDasharray="12 12"
              className={isSyncing ? 'animate-flow-fast' : 'animate-flow-slow'}
            />
            {/* Git to AI */}
            <line
              x1="500" y1="200" x2="800" y2="200"
              stroke="#facc15"
              strokeWidth="6"
              strokeDasharray="12 12"
              className={isAuditing || isSyncing ? 'animate-flow-fast' : 'animate-flow-slow'}
            />
            {/* Feedback loop */}
            <path
              d="M 800 260 L 800 340 L 200 340 L 200 260"
              fill="none"
              stroke="#4ade80"
              strokeWidth="3"
              strokeDasharray="8 8"
              className="animate-flow-reverse opacity-40"
            />
          </svg>

          {/* Nodes */}
          <div className="absolute inset-0">

            {/* Featurebase Node — clickable link to dashboard */}
            <a
              href="https://feedback.sudowrite.com/dashboard/articles"
              target="_blank"
              rel="noopener noreferrer"
              className="absolute left-[20%] top-[50%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10 group"
            >
              <div className="text-[#88ccdd] font-mono text-xs mb-2 uppercase tracking-widest bg-[#113338] px-2">
                Source
              </div>
              <div
                className={`w-24 h-24 rounded-lg flex flex-col items-center justify-center border-2 transition-colors duration-300 relative cursor-pointer group-hover:border-cyan-400 group-hover:shadow-[0_0_10px_rgba(34,211,238,0.3)] ${
                  isSyncing
                    ? 'bg-cyan-900/90 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.5)]'
                    : 'bg-[#1a2c35] border-[#2a4a55]'
                }`}
              >
                <Database className={`w-10 h-10 ${isSyncing ? 'text-cyan-300' : 'text-slate-400'}`} />
                <span className="font-mono text-white mt-2 font-bold">FB</span>
              </div>
              <div className="mt-3 text-sm text-slate-300 font-medium bg-[#113338] px-2 group-hover:text-cyan-400 transition-colors">
                Featurebase
              </div>
            </a>

            {/* Git Node — clickable link to repo */}
            <a
              href="https://github.com/sudowrite/docs-control"
              target="_blank"
              rel="noopener noreferrer"
              className="absolute left-[50%] top-[50%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10 group"
            >
              <div className="text-[#88ccdd] font-mono text-xs mb-2 uppercase tracking-widest bg-[#113338] px-2">
                Storage
              </div>
              <div className={`w-24 h-24 rounded-lg flex flex-col items-center justify-center border-2 transition-colors duration-300 relative cursor-pointer group-hover:border-green-400 group-hover:shadow-[0_0_10px_rgba(74,222,128,0.3)] ${
                isSyncing
                  ? 'bg-green-900/60 border-green-400 shadow-[0_0_15px_rgba(74,222,128,0.3)]'
                  : 'bg-[#1a2c35] border-[#2a4a55]'
              }`}>
                <GitBranch className={`w-10 h-10 ${isSyncing ? 'text-green-300' : 'text-green-400'}`} />
                <span className="font-mono text-white mt-2 font-bold">GIT</span>
              </div>
              <div className="mt-3 text-sm text-slate-300 font-medium bg-[#113338] px-2 group-hover:text-green-400 transition-colors">
                Repository
              </div>
            </a>

            {/* AI Node */}
            <div className="absolute left-[80%] top-[50%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10">
              <div className="text-[#88ccdd] font-mono text-xs mb-2 uppercase tracking-widest bg-[#113338] px-2">
                Processor
              </div>
              <div
                className={`w-24 h-24 rounded-lg flex flex-col items-center justify-center border-2 transition-colors duration-300 relative ${
                  isAuditing
                    ? 'bg-purple-900/90 border-purple-400 shadow-[0_0_15px_rgba(192,132,252,0.5)]'
                    : 'bg-[#1a2c35] border-[#2a4a55]'
                }`}
              >
                <Sparkles className={`w-10 h-10 ${isAuditing ? 'text-purple-300' : 'text-purple-400'}`} />
                <span className="font-mono text-white mt-2 font-bold">AI</span>
              </div>
              <div className="mt-3 text-sm text-slate-300 font-medium bg-[#113338] px-2">
                AI Engine
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Stats / Controls Bar */}
        <div className="bg-[#0d1b1e] p-4 flex justify-between items-center border-t border-[#1a4a50] relative z-20">
          {/* Pill Buttons */}
          <div className="flex gap-4">
            <button
              onClick={handleSync}
              disabled={isSyncing || isAuditing}
              className="group relative px-6 py-1.5 rounded-full border-2 border-[#4ade80] bg-transparent text-[#4ade80] font-mono text-sm font-bold uppercase tracking-wider hover:bg-[#4ade80] hover:text-[#0d1b1e] transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
            >
              <div className="flex items-center gap-2">
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Sync</span>
              </div>
            </button>

            <button
              onClick={handleAudit}
              disabled={isAuditing || isSyncing}
              className="group relative px-6 py-1.5 rounded-full border-2 border-[#88ccdd] bg-transparent text-[#88ccdd] font-mono text-sm font-bold uppercase tracking-wider hover:bg-[#88ccdd] hover:text-[#0d1b1e] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-2">
                <FileSearch className="w-4 h-4" />
                <span>Audit</span>
              </div>
            </button>
          </div>

          {/* Live Stats */}
          <div className="flex gap-8 font-mono">
            <div>
              <div className="text-[#88ccdd] text-[10px] uppercase tracking-widest">Articles</div>
              <div className="text-white text-xl">{articleCount}</div>
            </div>
            <div>
              <div className="text-[#88ccdd] text-[10px] uppercase tracking-widest">Last Sync</div>
              <div className="text-white text-sm mt-0.5">{lastSync}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Lower Control Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <div className="bg-[#1e293b] rounded-xl p-5 border border-slate-700/50">
          <h3 className="text-slate-200 font-medium mb-2 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-cyan-400" />
            Synchronization
          </h3>
          <p className="text-slate-400 text-sm mb-4 leading-relaxed">
            Pull latest documentation structures from Featurebase and push local
            repository changes to maintain parity.
          </p>
          <button
            onClick={handleSync}
            disabled={isSyncing || isAuditing}
            className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {isSyncing ? 'Syncing...' : 'Force Sync Now'}
          </button>
        </div>

        <div className="bg-[#1e293b] rounded-xl p-5 border border-slate-700/50">
          <h3 className="text-slate-200 font-medium mb-2 flex items-center gap-2">
            <FileSearch className="w-4 h-4 text-purple-400" />
            Documentation Audit
          </h3>
          <p className="text-slate-400 text-sm mb-3 leading-relaxed">
            Paste a changelog entry to check for doc contradictions.
          </p>
          <textarea
            value={changelogText}
            onChange={(e) => setChangelogText(e.target.value)}
            placeholder="Paste changelog content here..."
            className="w-full bg-[#0f1923] border border-slate-600 rounded-lg p-3 text-sm text-slate-300 placeholder-slate-500 mb-3 resize-none focus:outline-none focus:border-purple-500 font-mono"
            rows={3}
          />
          <button
            onClick={handleAudit}
            disabled={isAuditing || isSyncing || !changelogText.trim()}
            className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {isAuditing ? 'Auditing...' : 'Run Deep Audit'}
          </button>
        </div>
      </div>

      {/* Activity Log */}
      {log.length > 0 && (
        <div className="mt-6 bg-[#0d1b1e] rounded-xl p-4 border border-[#1a4a50]">
          <h3 className="text-[#88ccdd] font-mono text-xs uppercase tracking-widest mb-3">
            Activity Log
          </h3>
          <div className="font-mono text-xs text-slate-400 max-h-48 overflow-y-auto space-y-1">
            {log.map((entry, i) => (
              <div key={i}>{entry}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

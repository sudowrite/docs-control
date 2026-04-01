'use client';

import { useState } from 'react';
import { Upload, Sparkles, Check, X, ChevronDown, ChevronUp } from 'lucide-react';

interface Proposal {
  id: string;
  articleTitle: string;
  articleSlug: string;
  editType: string;
  original: string;
  replacement: string;
  reasoning: string;
  confidence: string;
  autoApprovable: boolean;
  status: string;
}

const EDIT_TYPE_LABELS: Record<string, string> = {
  typo_fix: 'Typo Fix',
  factual_update: 'Factual Update',
  clarity_improvement: 'Clarity',
  rewrite: 'Rewrite',
  new_section: 'New Section',
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: 'text-green-400 bg-green-900/30 border-green-700',
  medium: 'text-yellow-400 bg-yellow-900/30 border-yellow-700',
  low: 'text-red-400 bg-red-900/30 border-red-700',
};

export default function ImprovePage() {
  const [feedbackText, setFeedbackText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [summary, setSummary] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const addLog = (msg: string) => {
    setLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const handleAnalyze = async () => {
    if (!feedbackText.trim()) return;
    setIsAnalyzing(true);
    setProposals([]);
    setSummary('');
    addLog('Uploading feedback...');

    try {
      const res = await fetch('/api/improve/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: feedbackText }),
      });
      const data = await res.json();

      if (data.success) {
        setProposals(data.proposals);
        setSummary(data.summary);
        addLog(`Analysis complete: ${data.proposalCount} proposals (${data.autoApprovable} auto-approvable, ${data.needsReview} need review)`);
      } else {
        addLog(`Error: ${data.error}`);
      }
    } catch (err) {
      addLog(`Error: ${err}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    const proposal = proposals.find((p) => p.id === id);
    if (action === 'approve') {
      addLog(`Applying edit to "${proposal?.articleTitle}"...`);
    }

    try {
      const res = await fetch('/api/improve/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Send full proposal so it works on Vercel (no persistent storage)
        body: JSON.stringify({ id, action, proposal }),
      });
      const data = await res.json();
      if (data.success) {
        const newStatus = data.status || (action === 'approve' ? 'approved' : 'rejected');
        setProposals((prev) =>
          prev.map((p) => (p.id === id ? { ...p, status: newStatus } : p))
        );
        if (action === 'approve' && data.applied) {
          const applied = data.applied;
          if (applied.github) addLog(`  Committed to GitHub: ${applied.githubUrl}`);
          if (applied.featurebase) addLog(`  Updated in Featurebase`);
          if (applied.errors?.length) {
            applied.errors.forEach((e: string) => addLog(`  Warning: ${e}`));
          }
        } else {
          addLog(`${action === 'approve' ? 'Approved' : 'Rejected'}: ${proposal?.articleTitle}`);
        }
      } else {
        addLog(`Error: ${data.error}`);
      }
    } catch (err) {
      addLog(`Failed to ${action} proposal: ${err}`);
    }
  };

  return (
    <div className="max-w-4xl w-full bg-[#1a222c] rounded-2xl p-4 md:p-6 shadow-2xl border border-slate-800">

      <h2 className="text-xl font-semibold text-slate-100 mb-2 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-purple-400" />
        Improve Documentation
      </h2>
      <p className="text-slate-400 text-sm mb-6">
        Paste feedback data (HelpKit CSV, Featurebase export, or free text) and the AI will
        analyze it and propose specific documentation improvements.
      </p>

      {/* Feedback input */}
      <div className="bg-[#0f1923] rounded-lg p-4 border border-slate-700 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Upload className="w-4 h-4 text-slate-400" />
          <span className="text-slate-300 text-sm font-medium">Feedback Data</span>
          <span className="text-slate-600 text-xs">(CSV or free text)</span>
        </div>
        <textarea
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
          placeholder={`Paste HelpKit CSV export, Featurebase feedback, or free-text notes...\n\nExample CSV:\nFeedback,Title,Useful,Email,Created\n"I cannot pause, just cancel!!!!",How do I pause or cancel?,No,user@email.com,2025-06-15\n\nOr free text:\n- The credits article doesn't explain what happens when you run out\n- Mobile app docs are confusing about which features are available`}
          className="w-full bg-[#1a222c] border border-slate-600 rounded-lg p-3 text-sm text-slate-300 placeholder-slate-600 resize-none focus:outline-none focus:border-purple-500 font-mono"
          rows={8}
        />
        <div className="flex justify-between items-center mt-3">
          <span className="text-slate-600 text-xs">
            {feedbackText.trim()
              ? `${feedbackText.split('\n').filter(Boolean).length} lines`
              : 'Supports HelpKit CSV, Featurebase CSV, or free text'}
          </span>
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !feedbackText.trim()}
            className="px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Sparkles className={`w-4 h-4 ${isAnalyzing ? 'animate-pulse' : ''}`} />
            {isAnalyzing ? 'Analyzing...' : 'Analyze & Propose'}
          </button>
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div className="bg-[#113338] rounded-lg p-4 border border-[#1a4a50] mb-6">
          <h3 className="text-[#88ccdd] font-mono text-xs uppercase tracking-widest mb-2">Analysis Summary</h3>
          <p className="text-slate-300 text-sm">{summary}</p>
        </div>
      )}

      {/* Proposals */}
      {proposals.length > 0 && (
        <div className="space-y-3 mb-6">
          <h3 className="text-slate-300 text-sm font-medium">
            Proposals ({proposals.filter((p) => p.status === 'pending').length} pending)
          </h3>

          {proposals.map((proposal) => {
            const expanded = expandedId === proposal.id;
            return (
              <div
                key={proposal.id}
                className={`bg-[#0f1923] rounded-lg border transition-colors ${
                  proposal.status === 'approved'
                    ? 'border-green-800 opacity-60'
                    : proposal.status === 'rejected'
                    ? 'border-red-900 opacity-40'
                    : 'border-slate-700'
                }`}
              >
                {/* Header */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer"
                  onClick={() => setExpandedId(expanded ? null : proposal.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded border ${CONFIDENCE_COLORS[proposal.confidence]}`}>
                      {proposal.confidence}
                    </span>
                    <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                      {EDIT_TYPE_LABELS[proposal.editType] || proposal.editType}
                    </span>
                    <span className="text-slate-200 text-sm font-medium">{proposal.articleTitle}</span>
                    {proposal.autoApprovable && (
                      <span className="text-xs text-cyan-500 bg-cyan-900/30 px-2 py-0.5 rounded border border-cyan-800">
                        auto
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {proposal.status === 'pending' && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleAction(proposal.id, 'approve'); }}
                          className="p-1.5 text-green-500 hover:bg-green-900/30 rounded transition-colors"
                          title="Approve"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleAction(proposal.id, 'reject'); }}
                          className="p-1.5 text-red-500 hover:bg-red-900/30 rounded transition-colors"
                          title="Reject"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {proposal.status !== 'pending' && (
                      <span className={`text-xs ${proposal.status === 'approved' ? 'text-green-500' : 'text-red-500'}`}>
                        {proposal.status}
                      </span>
                    )}
                    {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                  </div>
                </div>

                {/* Expanded diff */}
                {expanded && (
                  <div className="px-4 pb-4 space-y-3">
                    <p className="text-slate-400 text-xs">{proposal.reasoning}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-red-400 text-xs font-mono mb-1">- Original</div>
                        <div className="bg-red-950/30 border border-red-900/50 rounded p-2 text-xs text-red-300 font-mono whitespace-pre-wrap">
                          {proposal.original}
                        </div>
                      </div>
                      <div>
                        <div className="text-green-400 text-xs font-mono mb-1">+ Replacement</div>
                        <div className="bg-green-950/30 border border-green-900/50 rounded p-2 text-xs text-green-300 font-mono whitespace-pre-wrap">
                          {proposal.replacement}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Activity Log */}
      {log.length > 0 && (
        <div className="bg-[#0d1b1e] rounded-xl p-4 border border-[#1a4a50]">
          <h3 className="text-[#88ccdd] font-mono text-xs uppercase tracking-widest mb-3">
            Activity Log
          </h3>
          <div className="font-mono text-xs text-slate-400 max-h-32 overflow-y-auto space-y-1">
            {log.map((entry, i) => (
              <div key={i}>{entry}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

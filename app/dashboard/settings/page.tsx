'use client';

import { useState, useEffect } from 'react';
import { Key, Plus, Trash2, Copy, Check, Eye, EyeOff } from 'lucide-react';

interface ApiKeyMeta {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export default function SettingsPage() {
  const [keys, setKeys] = useState<ApiKeyMeta[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [newRawKey, setNewRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchKeys = async () => {
    const res = await fetch('/api/keys');
    const data = await res.json();
    if (data.success) setKeys(data.keys);
    setLoading(false);
  };

  useEffect(() => { fetchKeys(); }, []);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    const res = await fetch('/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newKeyName.trim() }),
    });
    const data = await res.json();
    if (data.success) {
      setNewRawKey(data.key);
      setNewKeyName('');
      fetchKeys();
    }
  };

  const handleRevoke = async (id: string) => {
    const res = await fetch(`/api/keys?id=${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) fetchKeys();
  };

  const handleCopy = () => {
    if (newRawKey) {
      navigator.clipboard.writeText(newRawKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="max-w-4xl w-full bg-[#1a222c] rounded-2xl p-4 md:p-6 shadow-2xl border border-slate-800">
      <h2 className="text-xl font-semibold text-slate-100 mb-6 flex items-center gap-2">
        <Key className="w-5 h-5 text-cyan-400" />
        API Keys
      </h2>
      <p className="text-slate-400 text-sm mb-6">
        Create API keys for agents to access the Docs Control API programmatically.
        Keys use Bearer token authentication.
      </p>

      {/* New key creation */}
      <div className="bg-[#0f1923] rounded-lg p-4 border border-slate-700 mb-6">
        <div className="flex gap-3">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name (e.g. cliff-agent, my-script)"
            className="flex-1 bg-[#1a222c] border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <button
            onClick={handleCreate}
            disabled={!newKeyName.trim()}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Key
          </button>
        </div>

        {/* Show newly created key */}
        {newRawKey && (
          <div className="mt-4 p-3 bg-green-900/30 border border-green-700 rounded-lg">
            <p className="text-green-400 text-xs font-medium mb-2">
              Key created! Copy it now — it won't be shown again.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm font-mono text-green-300 bg-[#0a0f14] rounded px-3 py-2 break-all">
                {showKey ? newRawKey : newRawKey.slice(0, 13) + '••••••••••••••••••••••••••••••••••••••••••••••••••••'}
              </code>
              <button
                onClick={() => setShowKey(!showKey)}
                className="p-2 text-slate-400 hover:text-white transition-colors"
                title={showKey ? 'Hide' : 'Reveal'}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <button
                onClick={handleCopy}
                className="p-2 text-slate-400 hover:text-white transition-colors"
                title="Copy to clipboard"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Key list */}
      <div className="space-y-3">
        {loading ? (
          <p className="text-slate-500 text-sm">Loading keys...</p>
        ) : keys.length === 0 ? (
          <p className="text-slate-500 text-sm">No API keys yet. Create one above.</p>
        ) : (
          keys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between p-4 bg-[#0f1923] rounded-lg border border-slate-700"
            >
              <div>
                <div className="text-slate-200 text-sm font-medium">{key.name}</div>
                <div className="text-slate-500 text-xs font-mono mt-1">{key.keyPrefix}</div>
                <div className="text-slate-600 text-xs mt-1">
                  Created {new Date(key.createdAt).toLocaleDateString()}
                  {key.lastUsedAt && ` · Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                </div>
              </div>
              <button
                onClick={() => handleRevoke(key.id)}
                className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                title="Revoke key"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Usage instructions */}
      <div className="mt-8 bg-[#0f1923] rounded-lg p-4 border border-slate-700">
        <h3 className="text-slate-300 text-sm font-medium mb-3">Usage</h3>
        <div className="font-mono text-xs text-slate-400 space-y-2">
          <p className="text-[#88ccdd]"># List all articles</p>
          <p>curl -H &quot;Authorization: Bearer swdc_...&quot; {typeof window !== 'undefined' ? window.location.origin : ''}/api/agent/docs</p>
          <p className="text-[#88ccdd] mt-3"># Get specific article</p>
          <p>curl -H &quot;Authorization: Bearer swdc_...&quot; {typeof window !== 'undefined' ? window.location.origin : ''}/api/agent/docs?slug=write</p>
          <p className="text-[#88ccdd] mt-3"># Trigger sync</p>
          <p>curl -X POST -H &quot;Authorization: Bearer swdc_...&quot; {typeof window !== 'undefined' ? window.location.origin : ''}/api/agent/sync</p>
          <p className="text-[#88ccdd] mt-3"># Run audit</p>
          <p>curl -X POST -H &quot;Authorization: Bearer swdc_...&quot; -H &quot;Content-Type: application/json&quot; -d &apos;{`{"changelogText":"..."}`}&apos; {typeof window !== 'undefined' ? window.location.origin : ''}/api/agent/audit</p>
        </div>
      </div>
    </div>
  );
}

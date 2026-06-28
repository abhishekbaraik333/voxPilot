'use client';

import { useEffect, useState } from 'react';
import { Settings as SettingsIcon, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

interface Provider {
  name: string;
  status: string;
  details?: string;
}

export default function SettingsPage() {
  const { token } = useAuthStore();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    api.getProviderStatus(token)
      .then((res) => setProviders(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'connected': return <CheckCircle2 className="w-5 h-5 text-[var(--color-success)]" />;
      case 'error': return <XCircle className="w-5 h-5 text-[var(--color-danger)]" />;
      default: return <AlertCircle className="w-5 h-5 text-[var(--color-warning)]" />;
    }
  };

  return (
    <div className="max-w-3xl space-y-6 animate-[fade-in_0.2s_ease-out]">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Settings</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Provider connections and configuration
        </p>
      </div>

      {/* Provider Status */}
      <div className="card p-6">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-4">Provider Status</h2>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-muted)]" />
          </div>
        ) : (
          <div className="space-y-3">
            {providers.map((p) => (
              <div key={p.name} className="flex items-center justify-between p-4 rounded-lg bg-[var(--color-bg-tertiary)]">
                <div className="flex items-center gap-3">
                  <StatusIcon status={p.status} />
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">{p.name}</p>
                    {p.details && (
                      <p className="text-[12px] text-[var(--color-text-muted)] font-mono">{p.details}</p>
                    )}
                  </div>
                </div>
                <span className={`badge ${
                  p.status === 'connected' ? 'badge-success' :
                  p.status === 'error' ? 'badge-danger' : 'badge-warning'
                }`}>
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="card p-6">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-4">Configuration</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-bg-tertiary)]">
            <span className="text-sm text-[var(--color-text-secondary)]">Data Storage</span>
            <span className="text-sm text-[var(--color-text-muted)]">In-memory (resets on restart)</span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-bg-tertiary)]">
            <span className="text-sm text-[var(--color-text-secondary)]">Default Voice</span>
            <span className="text-sm text-[var(--color-text-muted)]">Rachel (Female, Natural)</span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-bg-tertiary)]">
            <span className="text-sm text-[var(--color-text-secondary)]">LLM Model</span>
            <span className="text-sm text-[var(--color-text-muted)] font-mono">inclusionai/ling-2.6-flash</span>
          </div>
        </div>
      </div>

      <div className="card p-5 border-dashed border-2 bg-transparent">
        <p className="text-sm text-[var(--color-text-muted)]">
          💡 Provider API keys and settings are configured via the <code className="font-mono text-[var(--color-accent)]">.env</code> file on the server.
          Update the file and restart the server to change providers.
        </p>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Phone, Clock, Volume2, Mic } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { formatDuration, formatTimestamp, getStatusBadge } from '@/lib/utils';
import type { CallRecord } from '@voxpilot/shared';

export default function CallDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuthStore();
  const [call, setCall] = useState<CallRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !id) return;
    api.getCall(token, id)
      .then((res) => setCall(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!call) {
    return (
      <div className="text-center py-20">
        <p className="text-[var(--color-text-muted)]">Call not found</p>
        <Link href="/history" className="text-[var(--color-accent)] text-sm mt-2 inline-block">
          ← Back to history
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6 animate-[fade-in_0.2s_ease-out]">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/history" className="p-2 rounded-lg hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Call Detail</h1>
        </div>
        <span className={`badge ${getStatusBadge(call.status)}`}>{call.status}</span>
      </div>

      {/* Call Info */}
      <div className="card p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <p className="text-[12px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1">To</p>
          <p className="font-mono text-sm text-[var(--color-text-primary)]">{call.toNumber}</p>
        </div>
        <div>
          <p className="text-[12px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Duration</p>
          <p className="text-sm text-[var(--color-text-primary)]">{call.duration ? formatDuration(call.duration) : '—'}</p>
        </div>
        <div>
          <p className="text-[12px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Started</p>
          <p className="text-sm text-[var(--color-text-primary)]">{call.startedAt ? new Date(call.startedAt).toLocaleString() : '—'}</p>
        </div>
        <div>
          <p className="text-[12px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Model</p>
          <p className="text-sm text-[var(--color-text-primary)]">{call.llmModel || '—'}</p>
        </div>
      </div>

      {/* Prompt Used */}
      <div className="card p-5">
        <h3 className="text-[13px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
          System Prompt
        </h3>
        <pre className="text-[13px] text-[var(--color-text-secondary)] whitespace-pre-wrap font-mono leading-relaxed bg-[var(--color-bg-tertiary)] p-4 rounded-lg">
          {call.prompt}
        </pre>
      </div>

      {/* Transcript */}
      <div className="card p-5">
        <h3 className="text-[13px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-4">
          Transcript
        </h3>

        {call.transcript.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] py-8 text-center">
            No transcript available
          </p>
        ) : (
          <div className="space-y-3">
            {call.transcript.filter(e => e.isFinal).map((entry, i) => (
              <div
                key={entry.id || i}
                className={`flex gap-3 ${entry.role === 'agent' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                  entry.role === 'agent'
                    ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]'
                    : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]'
                }`}>
                  {entry.role === 'agent' ? <Volume2 className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                </div>
                <div className={`max-w-[75%] ${entry.role === 'agent' ? 'text-right' : ''}`}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[11px] font-medium text-[var(--color-text-muted)]">
                      {entry.role === 'agent' ? 'AI Agent' : 'Caller'}
                    </span>
                    <span className="text-[10px] text-[var(--color-text-muted)] font-mono">
                      {formatTimestamp(entry.timestampMs)}
                    </span>
                  </div>
                  <p className={`text-[13px] leading-relaxed px-3 py-2 rounded-xl ${
                    entry.role === 'agent'
                      ? 'bg-[var(--color-accent-subtle)]'
                      : 'bg-[var(--color-bg-elevated)]'
                  } text-[var(--color-text-primary)]`}>
                    {entry.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

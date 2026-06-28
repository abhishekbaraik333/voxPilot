'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { History, PhoneOff, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { formatDuration, getStatusBadge } from '@/lib/utils';

export default function HistoryPage() {
  const { token } = useAuthStore();
  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    api.getCalls(token)
      .then((res) => setCalls(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="max-w-5xl space-y-6 animate-[fade-in_0.2s_ease-out]">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Call History</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          All calls from this session (resets on server restart)
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : calls.length === 0 ? (
        <div className="card p-16 flex flex-col items-center justify-center text-center">
          <PhoneOff className="w-12 h-12 text-[var(--color-text-muted)] mb-4" />
          <p className="text-lg font-medium text-[var(--color-text-secondary)]">No calls yet</p>
          <p className="text-sm text-[var(--color-text-muted)] mt-1 mb-6">
            Make your first call to see it here
          </p>
          <Link href="/calls" className="btn-primary">Make a Call</Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left text-[12px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider px-5 py-3">Phone Number</th>
                <th className="text-left text-[12px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider px-5 py-3">Status</th>
                <th className="text-left text-[12px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider px-5 py-3">Duration</th>
                <th className="text-left text-[12px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider px-5 py-3">Transcript</th>
                <th className="text-left text-[12px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider px-5 py-3">Time</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {calls.map((call) => (
                <tr key={call.id} className="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-hover)] transition-colors">
                  <td className="px-5 py-3.5 font-mono text-sm text-[var(--color-text-primary)]">
                    {call.toNumber}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`badge ${getStatusBadge(call.status)}`}>{call.status}</span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-[var(--color-text-secondary)]">
                    {call.duration ? formatDuration(call.duration) : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-[var(--color-text-muted)]">
                    {call.transcript?.length || 0} messages
                  </td>
                  <td className="px-5 py-3.5 text-sm text-[var(--color-text-muted)]">
                    {new Date(call.createdAt).toLocaleString()}
                  </td>
                  <td className="px-5 py-3.5">
                    <Link
                      href={`/calls/${call.id}`}
                      className="text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] text-[13px] inline-flex items-center gap-1"
                    >
                      View <ExternalLink className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

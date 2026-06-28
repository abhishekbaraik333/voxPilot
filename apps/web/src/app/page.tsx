'use client';

import { useEffect, useState } from 'react';
import { Phone, PhoneOff, Clock, CheckCircle2, XCircle, Activity } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { formatDuration } from '@/lib/utils';
import Link from 'next/link';

interface Stats {
  totalCalls: number;
  activeCalls: number;
  completedCalls: number;
  failedCalls: number;
  avgDuration: number;
}

export default function OverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentCalls, setRecentCalls] = useState<any[]>([]);
  const { token } = useAuthStore();

  useEffect(() => {
    if (!token) return;

    async function load() {
      try {
        const [statsRes, callsRes] = await Promise.all([
          api.getStats(token!),
          api.getCalls(token!),
        ]);
        setStats(statsRes.data);
        setRecentCalls(callsRes.data.slice(0, 5));
      } catch {
        // Stats not critical
      }
    }
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [token]);

  const statCards = [
    {
      label: 'Total Calls',
      value: stats?.totalCalls ?? 0,
      icon: Phone,
      color: 'var(--color-accent)',
      bg: 'var(--color-accent-subtle)',
    },
    {
      label: 'Active Now',
      value: stats?.activeCalls ?? 0,
      icon: Activity,
      color: 'var(--color-success)',
      bg: 'var(--color-success-subtle)',
    },
    {
      label: 'Completed',
      value: stats?.completedCalls ?? 0,
      icon: CheckCircle2,
      color: 'var(--color-info)',
      bg: 'var(--color-info-subtle)',
    },
    {
      label: 'Failed',
      value: stats?.failedCalls ?? 0,
      icon: XCircle,
      color: 'var(--color-danger)',
      bg: 'var(--color-danger-subtle)',
    },
  ];

  return (
    <div className="max-w-5xl space-y-8 animate-[fade-in_0.2s_ease-out]">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Dashboard</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Overview of your AI calling activity
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[13px] text-[var(--color-text-muted)]">{card.label}</span>
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ background: card.bg }}
                >
                  <Icon className="w-[18px] h-[18px]" style={{ color: card.color }} />
                </div>
              </div>
              <p className="text-3xl font-bold text-[var(--color-text-primary)]">{card.value}</p>
            </div>
          );
        })}
      </div>

      {/* Quick Action */}
      <div className="card p-6 border-dashed border-2 border-[var(--color-border)] bg-transparent flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Ready to make a call?</h3>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Enter a phone number and prompt to start an AI conversation
          </p>
        </div>
        <Link href="/calls" className="btn-primary">
          <Phone className="w-4 h-4" />
          Make a Call
        </Link>
      </div>

      {/* Recent Calls */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Recent Calls</h2>
          <Link href="/history" className="text-[13px] text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]">
            View all →
          </Link>
        </div>

        {recentCalls.length === 0 ? (
          <div className="card p-12 flex flex-col items-center justify-center text-center">
            <PhoneOff className="w-10 h-10 text-[var(--color-text-muted)] mb-3" />
            <p className="text-[var(--color-text-secondary)] font-medium">No calls yet</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              Your call history will appear here
            </p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left text-[12px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider px-4 py-3">To</th>
                  <th className="text-left text-[12px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-left text-[12px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider px-4 py-3">Duration</th>
                  <th className="text-left text-[12px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider px-4 py-3">Time</th>
                </tr>
              </thead>
              <tbody>
                {recentCalls.map((call) => (
                  <tr key={call.id} className="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-hover)] transition-colors">
                    <td className="px-4 py-3 text-sm font-mono text-[var(--color-text-primary)]">
                      <Link href={`/calls/${call.id}`} className="hover:text-[var(--color-accent)]">
                        {call.toNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${
                        call.status === 'completed' ? 'badge-success' :
                        call.status === 'in-progress' ? 'badge-info' :
                        call.status === 'failed' ? 'badge-danger' : 'badge-neutral'
                      }`}>
                        {call.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                      {call.duration ? formatDuration(call.duration) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--color-text-muted)]">
                      {new Date(call.createdAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Avg Duration */}
      {stats && stats.avgDuration > 0 && (
        <div className="card p-5 flex items-center gap-3">
          <Clock className="w-5 h-5 text-[var(--color-text-muted)]" />
          <span className="text-sm text-[var(--color-text-secondary)]">
            Average call duration: <span className="text-[var(--color-text-primary)] font-medium">{formatDuration(stats.avgDuration)}</span>
          </span>
        </div>
      )}
    </div>
  );
}

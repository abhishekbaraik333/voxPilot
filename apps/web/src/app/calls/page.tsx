'use client';

import { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Loader2, Mic, Volume2, Clock, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { useCallStore } from '@/stores/call.store';
import { formatDuration, formatTimestamp, getStatusBadge } from '@/lib/utils';
import type { PromptTemplate } from '@voxpilot/shared';

export default function CallsPage() {
  const { token } = useAuthStore();
  const { activeCall, liveTranscript, setActiveCall, clearTranscript } = useCallStore();

  // Form state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [prompt, setPrompt] = useState('');
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);

  // Auto-scroll transcript
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Load templates
  useEffect(() => {
    if (!token) return;
    api.getPrompts(token).then((res) => setTemplates(res.data)).catch(() => {});
  }, [token]);

  // Load active call on mount
  useEffect(() => {
    if (!token) return;
    api.getActiveCall(token).then((res) => {
      if (res.data) setActiveCall(res.data);
    }).catch(() => {});
  }, [token, setActiveCall]);

  // Elapsed timer
  useEffect(() => {
    if (!activeCall || !['in-progress', 'ringing'].includes(activeCall.status)) return;
    const start = activeCall.startedAt ? new Date(activeCall.startedAt).getTime() : Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeCall]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [liveTranscript]);

  // Template selection
  useEffect(() => {
    if (selectedTemplate) {
      const tmpl = templates.find((t) => t.id === selectedTemplate);
      if (tmpl) setPrompt(tmpl.systemPrompt);
    }
  }, [selectedTemplate, templates]);

  async function handleMakeCall() {
    if (!token || !phoneNumber || !prompt) return;
    setError('');
    setLoading(true);
    clearTranscript();

    try {
      const res = await api.makeCall(token, phoneNumber, prompt);
      setActiveCall({
        id: res.data.callId,
        status: res.data.status as any,
        toNumber: phoneNumber,
        fromNumber: '',
        prompt,
        voiceId: '',
        llmModel: '',
        direction: 'outbound',
        transcript: [],
        events: [],
        createdAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleEndCall() {
    if (!token || !activeCall) return;
    try {
      await api.endCall(token, activeCall.id);
      setActiveCall({ ...activeCall, status: 'completed' });
    } catch (err: any) {
      setError(err.message);
    }
  }

  const isCallActive = activeCall && ['queued', 'ringing', 'in-progress'].includes(activeCall.status);

  return (
    <div className="max-w-4xl space-y-6 animate-[fade-in_0.2s_ease-out]">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Make a Call</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Enter a phone number and prompt to start an AI conversation
        </p>
      </div>

      {/* Dialer Panel */}
      {!isCallActive && (
        <div className="card p-6 space-y-5">
          {/* Phone Number */}
          <div>
            <label className="block text-[13px] font-medium text-[var(--color-text-secondary)] mb-1.5">
              Phone Number
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="input-base font-mono text-lg"
              placeholder="+1 (555) 123-4567"
              disabled={loading}
            />
          </div>

          {/* Template Selector */}
          {templates.length > 0 && (
            <div>
              <label className="block text-[13px] font-medium text-[var(--color-text-secondary)] mb-1.5">
                Use a saved template (optional)
              </label>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="input-base"
                disabled={loading}
              >
                <option value="">Write custom prompt...</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* System Prompt */}
          <div>
            <label className="block text-[13px] font-medium text-[var(--color-text-secondary)] mb-1.5">
              System Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="input-base min-h-[160px] resize-y font-mono text-[13px] leading-relaxed"
              placeholder="You are Sarah, a friendly receptionist from Dr. Smith's office. You are calling to confirm an appointment..."
              disabled={loading}
            />
            <p className="text-[11px] text-[var(--color-text-muted)] mt-1.5">
              Describe who the AI should be, what to say, and how to behave on the call.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-[13px] text-[var(--color-danger)] bg-[var(--color-danger-subtle)] px-4 py-3 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Call Button */}
          <button
            onClick={handleMakeCall}
            disabled={loading || !phoneNumber || !prompt}
            className="btn-primary w-full justify-center py-3 text-[15px]"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Initiating call...
              </>
            ) : (
              <>
                <Phone className="w-5 h-5" />
                Start Call
              </>
            )}
          </button>
        </div>
      )}

      {/* Active Call Panel */}
      {isCallActive && (
        <div className="card overflow-hidden">
          {/* Call Header */}
          <div className="flex items-center justify-between p-5 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                activeCall.status === 'in-progress'
                  ? 'bg-[var(--color-success-subtle)]'
                  : 'bg-[var(--color-warning-subtle)]'
              }`}>
                <Phone className={`w-5 h-5 ${
                  activeCall.status === 'in-progress'
                    ? 'text-[var(--color-success)]'
                    : 'text-[var(--color-warning)]'
                }`} />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-lg text-[var(--color-text-primary)]">
                    {activeCall.toNumber}
                  </span>
                  <span className={`badge ${getStatusBadge(activeCall.status)}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-[pulse-dot_1.5s_ease-in-out_infinite]" />
                    {activeCall.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[13px] text-[var(--color-text-muted)]">
                  <Clock className="w-3.5 h-3.5" />
                  {formatDuration(elapsed)}
                </div>
              </div>
            </div>

            <button onClick={handleEndCall} className="btn-danger">
              <PhoneOff className="w-4 h-4" />
              End Call
            </button>
          </div>

          {/* Live Transcript */}
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-[var(--color-success)] animate-[pulse-dot_1.5s_ease-in-out_infinite]" />
              <span className="text-[13px] font-medium text-[var(--color-text-secondary)]">
                Live Transcript
              </span>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {liveTranscript.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Mic className="w-8 h-8 text-[var(--color-text-muted)] mb-2 animate-pulse" />
                  <p className="text-sm text-[var(--color-text-muted)]">
                    {activeCall.status === 'ringing'
                      ? 'Waiting for answer...'
                      : 'Listening for conversation...'}
                  </p>
                </div>
              ) : (
                liveTranscript.map((entry, i) => (
                  <div
                    key={entry.id || i}
                    className={`flex gap-3 animate-[slide-up_0.2s_ease-out] ${
                      entry.role === 'agent' ? 'flex-row-reverse' : ''
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-semibold ${
                      entry.role === 'agent'
                        ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]'
                        : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]'
                    }`}>
                      {entry.role === 'agent' ? (
                        <Volume2 className="w-3.5 h-3.5" />
                      ) : (
                        <Mic className="w-3.5 h-3.5" />
                      )}
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
                          ? 'bg-[var(--color-accent-subtle)] text-[var(--color-text-primary)]'
                          : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]'
                      } ${!entry.isFinal ? 'opacity-60' : ''}`}>
                        {entry.content}
                        {!entry.isFinal && (
                          <span className="inline-block w-1.5 h-4 bg-[var(--color-text-muted)] ml-0.5 animate-pulse" />
                        )}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={transcriptEndRef} />
            </div>
          </div>
        </div>
      )}

      {/* Completed call summary */}
      {activeCall && activeCall.status === 'completed' && (
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-full bg-[var(--color-success-subtle)] flex items-center justify-center">
              <Phone className="w-4 h-4 text-[var(--color-success)]" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Call Completed</h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                {activeCall.toNumber} • {formatDuration(elapsed)}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { setActiveCall(null); clearTranscript(); setElapsed(0); }}
              className="btn-primary"
            >
              <Phone className="w-4 h-4" />
              New Call
            </button>
            <a href={`/calls/${activeCall.id}`} className="btn-ghost">
              View Transcript
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

import type { CallRecord, PromptTemplate, TranscriptEntry, CallEvent, CallStatus } from '@voxpilot/shared';
import { generateId } from '../lib/utils.js';

/**
 * In-memory data store.
 * All data lives in Maps and is lost on server restart.
 * This is intentional for v1 — no database needed yet.
 */

// ─── Call Storage ────────────────────────────────────────────

const calls = new Map<string, CallRecord>();
const callsBySid = new Map<string, string>(); // twilio SID → call ID

export function createCallRecord(data: {
  toNumber: string;
  fromNumber: string;
  prompt: string;
  voiceId: string;
  llmModel: string;
}): CallRecord {
  const call: CallRecord = {
    id: generateId(),
    toNumber: data.toNumber,
    fromNumber: data.fromNumber,
    status: 'queued',
    direction: 'outbound',
    prompt: data.prompt,
    voiceId: data.voiceId,
    llmModel: data.llmModel,
    transcript: [],
    events: [],
    createdAt: new Date().toISOString(),
  };
  calls.set(call.id, call);
  return call;
}

export function getCall(id: string): CallRecord | undefined {
  return calls.get(id);
}

export function getCallBySid(sid: string): CallRecord | undefined {
  const callId = callsBySid.get(sid);
  return callId ? calls.get(callId) : undefined;
}

export function linkTwilioSid(callId: string, sid: string): void {
  callsBySid.set(sid, callId);
  const call = calls.get(callId);
  if (call) call.twilioCallSid = sid;
}

export function updateCallStatus(callId: string, status: CallStatus, extras?: Partial<CallRecord>): CallRecord | undefined {
  const call = calls.get(callId);
  if (!call) return undefined;

  call.status = status;
  if (extras) Object.assign(call, extras);

  // Add timeline event
  call.events.push({
    id: generateId(8),
    type: 'status_change',
    data: { status },
    timestampMs: call.startedAt
      ? Date.now() - new Date(call.startedAt).getTime()
      : 0,
  });

  return call;
}

export function addTranscriptEntry(callId: string, entry: Omit<TranscriptEntry, 'id'>): TranscriptEntry | undefined {
  const call = calls.get(callId);
  if (!call) return undefined;

  const fullEntry: TranscriptEntry = { ...entry, id: generateId(8) };

  // If interim (not final), replace the last interim entry of same role
  if (!entry.isFinal) {
    const lastIdx = call.transcript.findLastIndex(
      (e: TranscriptEntry) => e.role === entry.role && !e.isFinal
    );
    if (lastIdx >= 0) {
      call.transcript[lastIdx] = fullEntry;
      return fullEntry;
    }
  }

  call.transcript.push(fullEntry);
  return fullEntry;
}

export function addCallEvent(callId: string, event: Omit<CallEvent, 'id'>): void {
  const call = calls.get(callId);
  if (!call) return;
  call.events.push({ ...event, id: generateId(8) });
}

export function getAllCalls(): CallRecord[] {
  return Array.from(calls.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getActiveCalls(): CallRecord[] {
  return Array.from(calls.values())
    .filter((c) => c.status === 'ringing' || c.status === 'in-progress' || c.status === 'queued');
}

export function getStats() {
  const all = Array.from(calls.values());
  const completed = all.filter((c) => c.status === 'completed');
  const active = all.filter((c) => c.status === 'in-progress' || c.status === 'ringing');
  const failed = all.filter((c) => c.status === 'failed');
  const avgDuration = completed.length
    ? Math.round(completed.reduce((sum, c) => sum + (c.duration || 0), 0) / completed.length)
    : 0;

  return {
    totalCalls: all.length,
    activeCalls: active.length,
    completedCalls: completed.length,
    failedCalls: failed.length,
    avgDuration,
  };
}

// ─── Prompt Template Storage ─────────────────────────────────

const prompts = new Map<string, PromptTemplate>();

// Seed with a default template
const defaultPrompt: PromptTemplate = {
  id: 'default',
  name: 'Friendly Appointment Reminder',
  description: 'A warm and professional appointment reminder call',
  systemPrompt: `You are Sarah, a friendly and professional receptionist calling to confirm an appointment. 

Guidelines:
- Be warm, natural, and conversational
- Confirm the appointment date and time
- Ask if they need to reschedule
- If they want to reschedule, note their preferred time
- Keep the call brief and pleasant
- Thank them at the end

Important:
- Never mention you are an AI
- If asked, say you are calling from the office
- Handle interruptions naturally
- If they seem confused, clarify politely`,
  tone: 'friendly',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
prompts.set(defaultPrompt.id, defaultPrompt);

export function createPrompt(data: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>): PromptTemplate {
  const prompt: PromptTemplate = {
    ...data,
    id: generateId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  prompts.set(prompt.id, prompt);
  return prompt;
}

export function getPrompt(id: string): PromptTemplate | undefined {
  return prompts.get(id);
}

export function getAllPrompts(): PromptTemplate[] {
  return Array.from(prompts.values())
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function updatePrompt(id: string, data: Partial<PromptTemplate>): PromptTemplate | undefined {
  const prompt = prompts.get(id);
  if (!prompt) return undefined;
  Object.assign(prompt, data, { updatedAt: new Date().toISOString() });
  return prompt;
}

export function deletePrompt(id: string): boolean {
  return prompts.delete(id);
}

// ─── Call Types ──────────────────────────────────────────────

export type CallStatus =
  | 'queued'
  | 'ringing'
  | 'in-progress'
  | 'completed'
  | 'failed'
  | 'no-answer'
  | 'busy'
  | 'canceled';

export type CallDirection = 'outbound' | 'inbound';

export interface CallRecord {
  id: string;
  twilioCallSid?: string;
  toNumber: string;
  fromNumber: string;
  status: CallStatus;
  direction: CallDirection;
  prompt: string;
  voiceId: string;
  llmModel: string;
  startedAt?: string;
  answeredAt?: string;
  endedAt?: string;
  duration?: number;
  transcript: TranscriptEntry[];
  events: CallEvent[];
  outcome?: string;
  error?: string;
  createdAt: string;
}

// ─── Transcript Types ───────────────────────────────────────

export type TranscriptRole = 'user' | 'agent' | 'system';

export interface TranscriptEntry {
  id: string;
  role: TranscriptRole;
  content: string;
  timestampMs: number;
  isFinal: boolean;
  confidence?: number;
}

// ─── Call Events ─────────────────────────────────────────────

export type CallEventType =
  | 'status_change'
  | 'error'
  | 'interruption'
  | 'silence'
  | 'dtmf'
  | 'agent_thinking'
  | 'agent_speaking';

export interface CallEvent {
  id: string;
  type: CallEventType;
  data?: Record<string, unknown>;
  timestampMs: number;
}

// ─── Prompt Template ─────────────────────────────────────────

export interface PromptTemplate {
  id: string;
  name: string;
  description?: string;
  systemPrompt: string;
  tone?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── API Types ───────────────────────────────────────────────

export interface MakeCallRequest {
  toNumber: string;
  prompt: string;
  voiceId?: string;
  llmModel?: string;
}

export interface MakeCallResponse {
  callId: string;
  status: CallStatus;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: {
    email: string;
    name: string;
  };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─── Provider Status ─────────────────────────────────────────

export type ProviderStatus = 'connected' | 'error' | 'unconfigured';

export interface ProviderInfo {
  name: string;
  status: ProviderStatus;
  details?: string;
}

// ─── Dashboard Stats ─────────────────────────────────────────

export interface DashboardStats {
  totalCalls: number;
  activeCalls: number;
  completedCalls: number;
  failedCalls: number;
  avgDuration: number;
}

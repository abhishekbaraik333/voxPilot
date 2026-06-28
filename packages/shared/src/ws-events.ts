// ─── WebSocket Event Names ───────────────────────────────────

/** Server → Dashboard events */
export const WS_EVENTS = {
  // Call lifecycle
  CALL_STATUS: 'call:status',
  CALL_TRANSCRIPT: 'call:transcript',
  CALL_AGENT_RESPONSE: 'call:agent_response',
  CALL_EVENT: 'call:event',
  CALL_METRICS: 'call:metrics',
  CALL_ENDED: 'call:ended',

  // Dashboard-level
  ACTIVE_CALLS: 'calls:active',
  SYSTEM_STATUS: 'system:status',

  // Client → Server
  SUBSCRIBE_CALL: 'subscribe:call',
  UNSUBSCRIBE_CALL: 'unsubscribe:call',
  SUBSCRIBE_DASHBOARD: 'subscribe:dashboard',
} as const;

// ─── WebSocket Payload Types ─────────────────────────────────

import type { CallStatus, TranscriptEntry, CallEvent, ProviderInfo } from './types';

export interface WsCallStatusPayload {
  callId: string;
  status: CallStatus;
  timestamp: string;
  duration?: number;
}

export interface WsTranscriptPayload {
  callId: string;
  entry: TranscriptEntry;
}

export interface WsAgentResponsePayload {
  callId: string;
  text: string;
  timestampMs: number;
}

export interface WsCallEventPayload {
  callId: string;
  event: CallEvent;
}

export interface WsCallMetricsPayload {
  callId: string;
  sttLatencyMs: number;
  llmLatencyMs: number;
  ttsLatencyMs: number;
  totalLatencyMs: number;
}

export interface WsActiveCallsPayload {
  calls: Array<{
    id: string;
    toNumber: string;
    status: CallStatus;
    duration: number;
    startedAt: string;
  }>;
}

export interface WsSystemStatusPayload {
  providers: ProviderInfo[];
}

// ─── Generic WS Message Wrapper ──────────────────────────────

export interface WsMessage<T = unknown> {
  event: string;
  data: T;
  timestamp: string;
}

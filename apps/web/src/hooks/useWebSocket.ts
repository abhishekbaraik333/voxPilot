'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useCallStore } from '@/stores/call.store';
import { WS_EVENTS } from '@voxpilot/shared';

const getWsUrl = () => {
  if (process.env.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL.replace(/\/$/, '');
  }
  if (typeof window === 'undefined') {
    return 'ws://localhost:3001';
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  // If local development on port 3000, talk directly to backend on 3001
  if (window.location.port === '3000') {
    return `${protocol}//${window.location.hostname}:3001`;
  }
  // Otherwise, route to the same host (e.g. VPS reverse proxied path)
  return `${protocol}//${window.location.host}`;
};

const WS_URL = getWsUrl();

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const { token } = useAuthStore();
  const { updateCallStatus, addTranscriptEntry, callEnded } = useCallStore();

  const connect = useCallback(() => {
    if (!token) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(`${WS_URL}/ws/dashboard?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected to dashboard');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const { event: eventName, data } = msg;

        switch (eventName) {
          case WS_EVENTS.CALL_STATUS:
            updateCallStatus(data.callId, data.status);
            break;

          case WS_EVENTS.CALL_TRANSCRIPT:
            addTranscriptEntry(data.entry);
            break;

          case WS_EVENTS.CALL_ENDED:
            callEnded(data.callId);
            break;

          default:
            // Other events handled by specific components
            break;
        }
      } catch {
        // Ignore parse errors
      }
    };

    ws.onclose = () => {
      console.log('[WS] Disconnected, reconnecting in 3s...');
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [token, updateCallStatus, addTranscriptEntry, callEnded]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return wsRef;
}

'use client';

import { create } from 'zustand';
import type { CallRecord, TranscriptEntry, CallStatus } from '@voxpilot/shared';

interface CallState {
  activeCall: CallRecord | null;
  callHistory: CallRecord[];
  liveTranscript: TranscriptEntry[];

  setActiveCall: (call: CallRecord | null) => void;
  updateCallStatus: (callId: string, status: CallStatus) => void;
  addTranscriptEntry: (entry: TranscriptEntry) => void;
  clearTranscript: () => void;
  setCallHistory: (calls: CallRecord[]) => void;
  callEnded: (callId: string) => void;
}

export const useCallStore = create<CallState>((set, get) => ({
  activeCall: null,
  callHistory: [],
  liveTranscript: [],

  setActiveCall: (call) => set({ activeCall: call, liveTranscript: call?.transcript || [] }),

  updateCallStatus: (callId, status) => {
    const { activeCall } = get();
    if (activeCall && activeCall.id === callId) {
      set({ activeCall: { ...activeCall, status } });
    }
  },

  addTranscriptEntry: (entry) => {
    const { liveTranscript } = get();
    // Replace interim entries of the same role
    if (!entry.isFinal) {
      const existingIdx = liveTranscript.findLastIndex(
        (e) => e.role === entry.role && !e.isFinal
      );
      if (existingIdx >= 0) {
        const updated = [...liveTranscript];
        updated[existingIdx] = entry;
        set({ liveTranscript: updated });
        return;
      }
    }
    set({ liveTranscript: [...liveTranscript, entry] });
  },

  clearTranscript: () => set({ liveTranscript: [] }),

  setCallHistory: (calls) => set({ callHistory: calls }),

  callEnded: (callId) => {
    const { activeCall } = get();
    if (activeCall && activeCall.id === callId) {
      set({
        activeCall: { ...activeCall, status: 'completed' as CallStatus },
      });
    }
  },
}));

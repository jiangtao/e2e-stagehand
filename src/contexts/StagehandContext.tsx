'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useStagehandWebSocket } from '@/lib/websocket/client-hook';

interface StagehandContextType {
  isConnected: boolean;
  instances: any[];
  operations: any[];
  error: string | null;
  sendMessage: (message: any) => void;
  requestInstanceStatus: (instanceId: string) => void;
  clearError: () => void;
  reconnect: () => void;
}

const StagehandContext = createContext<StagehandContextType | undefined>(undefined);

export function StagehandProvider({ children }: { children: ReactNode }) {
  const websocketState = useStagehandWebSocket();

  return (
    <StagehandContext.Provider value={websocketState}>
      {children}
    </StagehandContext.Provider>
  );
}

export function useStagehand() {
  const context = useContext(StagehandContext);
  if (context === undefined) {
    throw new Error('useStagehand must be used within a StagehandProvider');
  }
  return context;
}

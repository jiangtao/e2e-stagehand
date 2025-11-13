import { Protocol } from 'chrome-remote-interface';

export interface ElectronInstance {
  id: string;
  port: number;
  appPath?: string;
  pid?: number;
  status: 'connected' | 'disconnected' | 'error';
  connectedAt: Date;
  lastActivity: Date;
}

export interface CDPCommand {
  method: string;
  params?: any;
}

export interface CDPResponse {
  id: number;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}

export interface StagehandConfig {
  modelProvider: 'openai' | 'anthropic' | 'custom';
  apiKey: string;
  customApiUrl?: string;
  modelName?: string;
}

export interface TaskConfig {
  id: string;
  instanceId: string;
  action: string;
  description?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
  result?: any;
  error?: string;
}

export interface OperationEvent {
  type: 'click' | 'type' | 'scroll' | 'navigate' | 'extract' | 'observe';
  timestamp: Date;
  instanceId: string;
  target?: {
    selector?: string;
    coordinates?: { x: number; y: number };
    text?: string;
  };
  result?: any;
}

export interface WebSocketMessage {
  type: 'operation' | 'status' | 'error' | 'log';
  instanceId?: string;
  data: any;
  timestamp: Date;
}

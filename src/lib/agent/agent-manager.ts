import { EventEmitter } from 'events';
import { WebSocket } from 'ws';
import { agentDB } from '@/lib/db/database';

export interface AgentConnection {
  agentId: string;
  userId: string;
  name?: string;
  ws: WebSocket;
  connectedAt: Date;
  lastHeartbeat: Date;
  cdpInstances: Set<string>; // 该代理客户端管理的 CDP 实例 ID
}

/**
 * 代理客户端管理器
 * 管理所有连接的代理客户端，路由 CDP 命令
 */
export class AgentManager extends EventEmitter {
  private agents: Map<string, AgentConnection> = new Map(); // agentId -> connection
  private instancesToAgents: Map<string, string> = new Map(); // instanceId -> agentId

  /**
   * 注册代理客户端
   */
  registerAgent(agentId: string, userId: string, name: string | undefined, ws: WebSocket): void {
    // 如果已存在，先断开旧连接
    if (this.agents.has(agentId)) {
      const oldConnection = this.agents.get(agentId)!;
      oldConnection.ws.close();
    }

    const connection: AgentConnection = {
      agentId,
      userId,
      name,
      ws,
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
      cdpInstances: new Set()
    };

    this.agents.set(agentId, connection);

    // 保存到数据库
    agentDB.save({
      id: agentId,
      userId,
      name,
      token: agentId, // 使用 agentId 作为 token
      status: 'connected',
      connectedAt: new Date()
    });

    // 设置 WebSocket 事件处理
    ws.on('close', () => {
      this.unregisterAgent(agentId);
    });

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleAgentMessage(agentId, message);
      } catch (error) {
        console.error(`❌ Error parsing message from agent ${agentId}:`, error);
      }
    });

    this.emit('agent_connected', agentId, userId);
    console.log(`✅ Agent registered: ${agentId} (User: ${userId})`);
  }

  /**
   * 注销代理客户端
   */
  unregisterAgent(agentId: string): void {
    const connection = this.agents.get(agentId);
    if (!connection) return;

    // 更新数据库
    agentDB.updateStatus(agentId, 'disconnected');

    // 清理实例映射
    connection.cdpInstances.forEach(instanceId => {
      this.instancesToAgents.delete(instanceId);
    });

    this.agents.delete(agentId);
    this.emit('agent_disconnected', agentId);
    console.log(`🔌 Agent unregistered: ${agentId}`);
  }

  /**
   * 处理代理客户端消息
   */
  private handleAgentMessage(agentId: string, message: any): void {
    const connection = this.agents.get(agentId);
    if (!connection) return;

    switch (message.type) {
      case 'heartbeat':
      case 'pong':
        connection.lastHeartbeat = new Date();
        agentDB.updateHeartbeat(agentId);
        break;

      case 'cdp_instance_connected':
        if (message.data?.instanceId) {
          connection.cdpInstances.add(message.data.instanceId);
          this.instancesToAgents.set(message.data.instanceId, agentId);
          this.emit('cdp_instance_connected', message.data.instanceId, agentId);
        }
        break;

      case 'cdp_instance_disconnected':
        if (message.data?.instanceId) {
          connection.cdpInstances.delete(message.data.instanceId);
          this.instancesToAgents.delete(message.data.instanceId);
          this.emit('cdp_instance_disconnected', message.data.instanceId, agentId);
        }
        break;

      case 'cdp_response':
      case 'cdp_event':
        // 转发 CDP 响应和事件到 WebSocket 服务器
        this.emit('cdp_message', message);
        break;

      default:
        console.warn(`⚠️ Unknown message type from agent ${agentId}: ${message.type}`);
    }
  }

  /**
   * 发送 CDP 命令到代理客户端
   */
  sendCDPCommand(instanceId: string, method: string, params?: any, requestId?: string): boolean {
    const agentId = this.instancesToAgents.get(instanceId);
    if (!agentId) {
      return false;
    }

    const connection = this.agents.get(agentId);
    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      connection.ws.send(JSON.stringify({
        type: 'cdp_command',
        instanceId,
        requestId,
        data: { method, params },
        timestamp: new Date()
      }));
      return true;
    } catch (error) {
      console.error(`❌ Error sending CDP command to agent ${agentId}:`, error);
      return false;
    }
  }

  /**
   * 请求代理客户端连接 CDP 实例
   */
  requestCDPConnect(instanceId: string, port: number): boolean {
    const agentId = this.instancesToAgents.get(instanceId);
    if (!agentId) {
      // 需要找到用户的代理客户端
      // 这里简化处理：使用第一个可用的代理客户端
      const userAgents = Array.from(this.agents.values());
      if (userAgents.length === 0) {
        return false;
      }
      // 暂时使用第一个代理（后续可以根据 userId 选择）
      const connection = userAgents[0];
      try {
        connection.ws.send(JSON.stringify({
          type: 'cdp_connect',
          instanceId,
          data: { port },
          timestamp: new Date()
        }));
        return true;
      } catch (error) {
        console.error(`❌ Error requesting CDP connect:`, error);
        return false;
      }
    }

    const connection = this.agents.get(agentId);
    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      connection.ws.send(JSON.stringify({
        type: 'cdp_connect',
        instanceId,
        data: { port },
        timestamp: new Date()
      }));
      return true;
    } catch (error) {
      console.error(`❌ Error requesting CDP connect:`, error);
      return false;
    }
  }

  /**
   * 请求代理客户端断开 CDP 实例
   */
  requestCDPDisconnect(instanceId: string): boolean {
    const agentId = this.instancesToAgents.get(instanceId);
    if (!agentId) {
      return false;
    }

    const connection = this.agents.get(agentId);
    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      connection.ws.send(JSON.stringify({
        type: 'cdp_disconnect',
        instanceId,
        timestamp: new Date()
      }));
      return true;
    } catch (error) {
      console.error(`❌ Error requesting CDP disconnect:`, error);
      return false;
    }
  }

  /**
   * 获取用户的代理客户端列表
   */
  getAgentsByUserId(userId: string): AgentConnection[] {
    return Array.from(this.agents.values()).filter(agent => agent.userId === userId);
  }

  /**
   * 获取所有代理客户端
   */
  getAllAgents(): AgentConnection[] {
    return Array.from(this.agents.values());
  }

  /**
   * 获取代理客户端信息
   */
  getAgent(agentId: string): AgentConnection | null {
    return this.agents.get(agentId) || null;
  }

  /**
   * 检查实例是否通过代理连接
   */
  isInstanceViaAgent(instanceId: string): boolean {
    return this.instancesToAgents.has(instanceId);
  }

  /**
   * 获取实例的代理 ID
   */
  getAgentForInstance(instanceId: string): string | null {
    return this.instancesToAgents.get(instanceId) || null;
  }
}

// 单例实例
export const agentManager = new AgentManager();


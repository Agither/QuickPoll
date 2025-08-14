// Stabile WebSocket Hook Implementation ohne Endlosschleifen

import { useState, useEffect, useRef, useCallback } from 'react';
import { getSessionId } from '../lib/session';

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

interface UseWebSocketProps {
  surveyId: string | null;
  role: 'host' | 'participant';
  onMessage?: (message: WebSocketMessage) => void;
  enabled?: boolean;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  lastMessage: WebSocketMessage | null;
  error: string | null;
  sendMessage: (message: WebSocketMessage) => void;
  connect: () => void;
  disconnect: () => void;
}

export function useWebSocketStable({
  surveyId,
  role,
  onMessage,
  enabled = true
}: UseWebSocketProps): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 3;
  const isConnectingRef = useRef(false);
  const mountedRef = useRef(false);
  
  // Set mounted flag on mount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }
    
    isConnectingRef.current = false;
    setIsConnected(false);
  }, []);

  const connect = useCallback(() => {
    // Frühe Exits für ungültige Zustände
    if (!surveyId || surveyId === 'null' || surveyId === 'undefined' || !mountedRef.current) {
      console.log('Connect aborted: invalid surveyId or not mounted', { surveyId, mounted: mountedRef.current });
      return;
    }
    
    if (isConnectingRef.current) {
      console.log('Connect aborted: already connecting');
      return;
    }
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('Connect aborted: already connected');
      return;
    }
    
    if (wsRef.current?.readyState === WebSocket.CONNECTING) {
      console.log('Connect aborted: connection in progress');
      return;
    }

    isConnectingRef.current = true;
    console.log(`Actually connecting to WebSocket: ${role} for survey ${surveyId}`);

    try {
    const sessionId = getSessionId();
    
    const wsBaseUrl = process.env.NODE_ENV === 'production' ? 'wss://quickpoll.up.railway.app' : 'ws://localhost:8000';
    const wsUrl = `${wsBaseUrl}/ws/${role}/${surveyId}?session_id=${sessionId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) {
          ws.close();
          return;
        }
        
        console.log(`WebSocket connected as ${role} for survey ${surveyId}`);
        setIsConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
        isConnectingRef.current = false;
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('WebSocket message received:', message);
          
          setLastMessage(message);
          
          if (onMessage) {
            onMessage(message);
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.onclose = (event) => {
        console.log(`WebSocket closed: ${event.code} ${event.reason}`);
        setIsConnected(false);
        wsRef.current = null;
        isConnectingRef.current = false;
        
        // Nur reconnect wenn mounted und es ein unerwarteter Close war
        if (mountedRef.current && 
            event.code !== 1000 && event.code !== 1001 && 
            reconnectAttempts.current < maxReconnectAttempts) {
          
          const delay = Math.min(5000 * Math.pow(2, reconnectAttempts.current), 30000);
          console.log(`Reconnecting in ${delay}ms... (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              reconnectAttempts.current++;
              connect();
            }
          }, delay);
        } else {
          console.log('WebSocket permanently closed');
        }
      };

      ws.onerror = (event) => {
        console.error('WebSocket error:', event);
        setError('WebSocket connection error');
        isConnectingRef.current = false;
      };

    } catch (err) {
      console.error('Error creating WebSocket:', err);
      setError('Failed to create WebSocket connection');
      isConnectingRef.current = false;
    }
  }, [surveyId, role, onMessage]);

  const disconnect = useCallback(() => {
    console.log('Manual disconnect called');
    cleanup();
  }, [cleanup]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(message));
        console.log('WebSocket message sent:', message);
      } catch (err) {
        console.error('Error sending WebSocket message:', err);
        setError('Failed to send message');
      }
    } else {
      console.warn('WebSocket not connected, cannot send message:', message);
      setError('WebSocket not connected');
    }
  }, []);

  // Single effect für Connection Management
  useEffect(() => {
    console.log(`WebSocket effect called:`, { enabled, surveyId, role, type: typeof surveyId });
    
    if (enabled && surveyId && surveyId !== 'null' && surveyId !== 'undefined') {
      console.log(`WebSocket effect: enabling for ${role}/${surveyId}`);
      connect();
    } else {
      console.log(`WebSocket effect: disabling (enabled: ${enabled}, surveyId: ${surveyId})`);
      cleanup();
    }

    // Cleanup bei Unmount oder Dependency-Änderung
    return () => {
      cleanup();
    };
  }, [enabled, surveyId, role]); // Entfernt connect/cleanup aus dependencies

  return {
    isConnected,
    lastMessage,
    error,
    sendMessage,
    connect,
    disconnect
  };
}

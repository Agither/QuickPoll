// Polling Hook als Ersatz für WebSockets (Vercel-kompatibel)
import { useState, useEffect, useRef, useCallback } from 'react';
import { apiRequest } from '../lib/api';

export interface PollingMessage {
  type: string;
  survey_id?: string;
  waiting_count?: number;
  submitted_count?: number;
  total_participants?: number;
  is_started?: boolean;
  survey?: any;
  [key: string]: any;
}

interface UsePollingProps {
  surveyId: string;
  role: 'host' | 'participant';
  sessionId: string;
  enabled?: boolean;
  onMessage?: (message: PollingMessage) => void;
  intervalMs?: number; // Polling-Intervall in Millisekunden
}

interface UsePollingReturn {
  isConnected: boolean;
  lastMessage: PollingMessage | null;
  error: string | null;
  sendMessage: (message: PollingMessage) => void; // Für Kompatibilität
}

export function usePolling({
  surveyId,
  role,
  sessionId,
  enabled = true,
  onMessage,
  intervalMs = 2000, // Standard: alle 2 Sekunden
}: UsePollingProps): UsePollingReturn {
  
  const [lastMessage, setLastMessage] = useState<PollingMessage | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(enabled);

  // Polling-Funktion
  const poll = useCallback(async () => {
    if (!enabled || !isActiveRef.current) return;

    try {
      const endpoint = role === 'host' 
        ? `/polling/host/${surveyId}/status`
        : `/polling/participant/${surveyId}/status`;
      
      const params = sessionId ? `?session_id=${sessionId}` : '';
      const response = await apiRequest(`${endpoint}${params}`);
      
      if (response && typeof response === 'object') {
        const message = response as PollingMessage;
        setLastMessage(message);
        setIsConnected(true);
        setError(null);
        
        if (onMessage) {
          onMessage(message);
        }
      }
    } catch (err) {
      console.error('Polling error:', err);
      setError(err instanceof Error ? err.message : 'Polling failed');
      setIsConnected(false);
    }
  }, [surveyId, role, sessionId, enabled, onMessage]);

  // Polling starten/stoppen
  useEffect(() => {
    isActiveRef.current = enabled;
    
    if (enabled && surveyId) {
      console.log(`Starting polling for ${role} on survey ${surveyId}`);
      
      // Sofort einmal ausführen
      poll();
      
      // Dann regelmäßig wiederholen
      intervalRef.current = setInterval(poll, intervalMs);
      
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        isActiveRef.current = false;
        setIsConnected(false);
      };
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsConnected(false);
    }
  }, [enabled, surveyId, poll, intervalMs]);

  // Cleanup bei Unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      isActiveRef.current = false;
    };
  }, []);

  // Für Kompatibilität mit WebSocket-Interface
  const sendMessage = useCallback((message: PollingMessage) => {
    console.log('Polling does not support sending messages directly:', message);
    // In einem echten System würde hier ein POST-Request gemacht werden
  }, []);

  return {
    isConnected,
    lastMessage,
    error,
    sendMessage,
  };
}

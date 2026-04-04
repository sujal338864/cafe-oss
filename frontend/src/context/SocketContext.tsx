'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

type SocketConfig = {
  socket: Socket | null;
  connected: boolean;
};

const SocketContext = createContext<SocketConfig>({ socket: null, connected: false });

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Only connect if user is authenticated and has a shopId
    if (!user?.shopId) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
    console.log(`[Socket] Connecting to ${apiUrl} for shop ${user.shopId}`);

    const newSocket = io(apiUrl, {
      query: { shopId: user.shopId },
      transports: ['websocket'], // Force WebSocket to avoid CORS polling issues
    });

    newSocket.on('connect', () => {
      console.log('[Socket] Connected to backend');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('[Socket] Disconnected from backend');
      setConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user?.shopId]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
};

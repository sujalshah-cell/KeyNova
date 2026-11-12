
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  'http://localhost:5000';

export function SocketProvider({ children }) {
  const { token } = useAuth();

  const socketRef = useRef(null);

  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // No authentication token = no socket connection
    if (!token) {
      if (socketRef.current) {
        console.log('[socket] disconnecting because token is missing');

        socketRef.current.disconnect();
        socketRef.current = null;
      }

      setSocket(null);
      setConnected(false);
      return;
    }

    console.log('[socket] creating connection:', SOCKET_URL);

    // Prevent duplicate connections
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const newSocket = io(SOCKET_URL, {
      auth: {
        token,
      },

      autoConnect: true,

      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 2000,

      transports: ['websocket', 'polling'],
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    const handleConnect = () => {
      console.log('[socket] CONNECTED:', newSocket.id);
      setConnected(true);
    };

    const handleDisconnect = (reason) => {
      console.log('[socket] DISCONNECTED:', reason);
      setConnected(false);
    };

    const handleConnectError = (error) => {
      console.error('[socket] CONNECTION ERROR:', error.message);
      setConnected(false);
    };

    newSocket.on('connect', handleConnect);
    newSocket.on('disconnect', handleDisconnect);
    newSocket.on('connect_error', handleConnectError);

    return () => {
      console.log('[socket] cleaning up connection');

      newSocket.off('connect', handleConnect);
      newSocket.off('disconnect', handleDisconnect);
      newSocket.off('connect_error', handleConnectError);

      newSocket.disconnect();

      if (socketRef.current === newSocket) {
        socketRef.current = null;
      }

      setConnected(false);
    };
  }, [token]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        connected,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);

  if (!context) {
    throw new Error(
      'useSocket must be used inside <SocketProvider>'
    );
  }

  return context;
}

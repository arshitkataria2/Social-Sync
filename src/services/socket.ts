import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, { autoConnect: false });
  }
  return socket;
}

export function connectSocket(userId: string) {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  s.emit('register', userId);
  return s;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
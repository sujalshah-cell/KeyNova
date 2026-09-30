import api from './api';
import { ROOMS } from './endpoints';

export async function createRoom({ mode, duration, password, maxPlayers, customText }) {
  const { data } = await api.post(ROOMS.create, { mode, duration, password, maxPlayers, customText });
  return data.room ?? data;
}

// Fixed: backend is POST /rooms/join with { roomId, password } in the body —
// not POST /rooms/:roomId/join as previously guessed.
export async function joinRoom(roomId, password) {
  const { data } = await api.post(ROOMS.join, { roomId, password });
  return data.room ?? data;
}

export async function getRoom(roomId) {
  const { data } = await api.get(ROOMS.get(roomId));
  return data.room ?? data;
}

// NOTE: there is currently no "leave room" endpoint on the backend, and no
// part of the UI calls this yet. Left here (rather than deleted) so the
// shape is ready the moment a real POST /rooms/:roomId/leave route exists —
// calling it today will 404.
export async function leaveRoom() {
  throw new Error('Leaving a room is not supported by the backend yet.');
}

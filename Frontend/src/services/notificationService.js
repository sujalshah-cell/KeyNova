import api from './api';
import { NOTIFICATIONS } from './endpoints';

// Fixed: backend returns { items, unreadCount }, not { notifications }.
export async function fetchNotifications() {
  const { data } = await api.get(NOTIFICATIONS.list);
  return data.items ?? [];
}

export async function fetchUnreadCount() {
  const { data } = await api.get(NOTIFICATIONS.list);
  return data.unreadCount ?? 0;
}

// Fixed: backend route is POST, not PATCH.
export async function markRead(id) {
  const { data } = await api.post(NOTIFICATIONS.markRead(id));
  return data;
}

export async function markAllRead() {
  const { data } = await api.post(NOTIFICATIONS.markAllRead);
  return data;
}

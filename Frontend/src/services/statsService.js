import api from './api';
import { STATS } from './endpoints';

// Fixed: backend route is POST /stats/result (not POST /stats).
export async function submitResult(result) {
  const { data } = await api.post(STATS.submit, result);
  return data; // { result, stats, streak }
}

// Fixed: backend route is GET /stats, returning { stats, streak, recent }.
// There is no separate /stats/history or /stats/leaderboard endpoint.
export async function fetchOverview() {
  const { data } = await api.get(STATS.overview);
  return data; // { stats, streak, recent }
}

export async function fetchHistory() {
  const { recent } = await fetchOverview();
  return recent ?? [];
}

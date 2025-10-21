const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
const WS_BASE  = import.meta.env.VITE_WS_BASE  || 'ws://localhost:8000'

export const endpoints = {
  // REST
  me: `${API_BASE}/api/auth/me`,
  login: `${API_BASE}/api/auth/login`, // POST {code? provider?}
  games: `${API_BASE}/api/games`,      // POST create, GET list
  game: (id: string) => `${API_BASE}/api/games/${id}`,
  moves: (id: string) => `${API_BASE}/api/games/${id}/moves`, // GET history
  records: `${API_BASE}/api/records`,

  // WS (server should accept JSON messages per types/index.ts)
  wsGame: (id: string) => `${WS_BASE}/ws/games/${id}`,
}

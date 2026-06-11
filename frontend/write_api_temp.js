const fs = require('fs');
const content = \const API_BASE = 'http://localhost:4000';

export const api = {
  get: async (url: string): Promise<any> => {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(API_BASE + url, { headers });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  },
  post: async (url: string, body: any): Promise<any> => {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(API_BASE + url, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  },
  put: async (url: string, body: any): Promise<any> => {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(API_BASE + url, { method: 'PUT', headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  },
  delete: async (url: string): Promise<any> => {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(API_BASE + url, { method: 'DELETE', headers });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }
};

export async function compareQP(payload: any): Promise<any> {
  const res = await fetch(API_BASE + '/api/wizard/compare-qp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Comparison failed');
  return res.json();
}

export async function getComparisonResults(sessionId: string): Promise<any> {
  const res = await fetch(API_BASE + '/api/wizard/comparison/' + sessionId);
  if (!res.ok) throw new Error('Failed to load results');
  return res.json();
}

export async function saveCorrections(sessionId: string, corrections: any[]): Promise<any> {
  const res = await fetch(API_BASE + '/api/wizard/save-corrections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, corrections })
  });
  if (!res.ok) throw new Error('Failed to save corrections');
  return res.json();
}

export default api;
\;
fs.writeFileSync('src/services/api.ts', content, 'utf8');
console.log('Done. Lines:', content.split('\\n').length);

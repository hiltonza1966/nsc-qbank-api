const API_BASE = 'http://localhost:4000';

export async function compareQP(payload: any) {
  const response = await fetch(API_BASE + '/api/wizard/compare-qp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error('Comparison failed');
  return response.json();
}

export async function getComparisonResults(sessionId: string) {
  const response = await fetch(API_BASE + '/api/wizard/comparison/' + sessionId);
  if (!response.ok) throw new Error('Failed to load results');
  return response.json();
}

export async function saveCorrections(sessionId: string, corrections: any[]) {
  const response = await fetch(API_BASE + '/api/wizard/save-corrections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, corrections })
  });
  if (!response.ok) throw new Error('Failed to save corrections');
  return response.json();
}
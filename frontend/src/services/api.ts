const API_BASE = 'http://localhost:4000/api/qbank';

const defaultHeaders = {
  'Content-Type': 'application/json',
  'x-user-id': '1',
  'x-user-role': 'admin'
};

async function apiFetch(url: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// Items API
export const itemsApi = {
  list: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch(`/items${query}`);
  },
  get: (id: string) => apiFetch(`/items/${id}`),
  create: (data: any) => apiFetch('/items', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => apiFetch(`/items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  submit: (id: string) => apiFetch(`/items/${id}/submit`, { method: 'POST' }),
  approve: (id: string, data?: any) => apiFetch(`/items/${id}/approve`, { method: 'POST', body: JSON.stringify(data || {}) }),
  reject: (id: string, data?: any) => apiFetch(`/items/${id}/reject`, { method: 'POST', body: JSON.stringify(data || {}) }),
  transition: (id: string, toState: string, reason?: string) => 
    apiFetch(`/items/${id}/transition`, { method: 'POST', body: JSON.stringify({ to_state: toState, reason }) }),
  getWorkflow: (id: string) => apiFetch(`/items/${id}/workflow`),
  getVersions: (id: string) => apiFetch(`/items/${id}/versions`),
  snapshot: (id: string) => apiFetch(`/items/${id}/snapshot`, { method: 'POST' }),
  rollback: (id: string, versionId: number) => apiFetch(`/items/${id}/rollback`, { method: 'POST', body: JSON.stringify({ version_id: versionId }) }),
  getReviews: (id: string) => apiFetch(`/items/${id}/reviews`),
  addReview: (id: string, data: any) => apiFetch(`/items/${id}/reviews`, { method: 'POST', body: JSON.stringify(data) }),
  pending: () => apiFetch('/items/pending')
};

// Papers API
export const papersApi = {
  list: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch(`/papers${query}`);
  },
  get: (id: string) => apiFetch(`/papers/${id}`),
  generate: (data: any) => apiFetch('/papers/generate', { method: 'POST', body: JSON.stringify(data) }),
  assemble: (data: any) => apiFetch('/papers/assemble', { method: 'POST', body: JSON.stringify(data) }),
  submit: (id: string) => apiFetch(`/papers/${id}/submit`, { method: 'POST' }),
  approve: (id: string, data?: any) => apiFetch(`/papers/${id}/approve`, { method: 'POST', body: JSON.stringify(data || {}) }),
  reject: (id: string, data?: any) => apiFetch(`/papers/${id}/reject`, { method: 'POST', body: JSON.stringify(data || {}) }),
  validate: (id: string) => apiFetch(`/papers/${id}/validate`, { method: 'POST' }),
  export: (id: string, format: string) => apiFetch(`/papers/${id}/export`, { method: 'POST', body: JSON.stringify({ format }) }),
  getWorkflow: (id: string) => apiFetch(`/papers/${id}/workflow`),
  getApprovals: (id: string) => apiFetch(`/papers/${id}/approvals`)
};

// Templates API
export const templatesApi = {
  list: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch(`/templates${query}`);
  },
  get: (id: string) => apiFetch(`/templates/${id}`),
  create: (data: any) => apiFetch('/templates', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => apiFetch(`/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiFetch(`/templates/${id}`, { method: 'DELETE' }),
  clone: (id: string) => apiFetch(`/templates/${id}/clone`, { method: 'POST' })
};

// Lookup API
export const lookupApi = {
  getTable: (table: string) => apiFetch(`/lookup/${table}`)
};

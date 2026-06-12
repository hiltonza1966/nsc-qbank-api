// frontend/src/services/api.ts
// Complete API service — supports ALL existing pages + new pages

const API_BASE = '/api';

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'x-user-role': localStorage.getItem('qbank_role') || 'author',
  'x-user-id': localStorage.getItem('qbank_user_id') || '1',
});

async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getHeaders(),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error ${response.status}: ${error}`);
  }

  return response.json();
}

// ============================================
// ITEMS API (supports ItemReview.tsx, ItemStudio.tsx, etc.)
// ============================================
export const itemsApi = {
  // List items — accepts params object or string (itemId)
  get: (params?: Record<string, string> | string) => {
    if (typeof params === 'string') {
      return fetchAPI(`/qbank/items/${params}`);
    }
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return fetchAPI(`/qbank/items${query}`);
  },

  getById: (id: string) => fetchAPI(`/qbank/items/${id}`),
  create: (data: any) => fetchAPI('/qbank/items', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => fetchAPI(`/qbank/items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  submit: (id: string) => fetchAPI(`/qbank/items/${id}/submit`, { method: 'POST' }),
  approve: (id: string) => fetchAPI(`/qbank/items/${id}/approve`, { method: 'POST' }),
  reject: (id: string) => fetchAPI(`/qbank/items/${id}/reject`, { method: 'POST' }),
  getVersions: (id: string) => fetchAPI(`/qbank/items/${id}/versions`),
  getPending: () => fetchAPI('/qbank/items/pending'),

  // Aliases for existing pages
  pending: () => fetchAPI('/qbank/items/pending'),
  getReviews: (id: string) => fetchAPI(`/qbank/items/${id}/reviews`),
  getWorkflow: (id: string) => fetchAPI(`/qbank/items/${id}/workflow`),
  addReview: (id: string, data: any) => fetchAPI(`/qbank/items/${id}/reviews`, { method: 'POST', body: JSON.stringify(data) }),
};

// ============================================
// LOOKUP API
// ============================================
export const lookupApi = {
  getTable: (table: string) => fetchAPI(`/lookup/${table}`),
};

// ============================================
// PAPERS API (supports PaperBuilder.tsx, PaperModeration.tsx, etc.)
// ============================================
export const papersApi = {
  // List — accepts optional params
  list: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return fetchAPI(`/qbank/papers${query}`);
  },

  // Alias for getById
  get: (id: string) => fetchAPI(`/qbank/papers/${id}`),
  getById: (id: string) => fetchAPI(`/qbank/papers/${id}`),
  generate: (data: any) => fetchAPI('/qbank/papers/generate', { method: 'POST', body: JSON.stringify(data) }),

  // Alias for compliance
  validate: (id: string) => fetchAPI(`/qbank/papers/${id}/validate`, { method: 'POST' }),
  compliance: (id: string) => fetchAPI(`/qbank/papers/${id}/validate`, { method: 'POST' }),

  submit: (id: string) => fetchAPI(`/qbank/papers/${id}/submit`, { method: 'POST' }),
  getWorkflow: (id: string) => fetchAPI(`/qbank/papers/${id}/workflow`),
  getApprovals: (id: string) => fetchAPI(`/qbank/papers/${id}/approvals`),
  approve: (id: string, data?: any) => fetchAPI(`/qbank/papers/${id}/approve`, { method: 'POST', body: JSON.stringify(data || {}) }),
  reject: (id: string, data?: any) => fetchAPI(`/qbank/papers/${id}/reject`, { method: 'POST', body: JSON.stringify(data || {}) }),
};

// ============================================
// TEMPLATES API
// ============================================
export const templatesApi = {
  list: () => fetchAPI('/qbank/templates'),
  getById: (id: string) => fetchAPI(`/qbank/templates/${id}`),
};

// ============================================
// FLAT FUNCTIONS (for new pages)
// ============================================
export async function getDashboardStats() {
  return fetchAPI('/dashboard/stats');
}

export async function getItems(params?: Record<string, string>) {
  return itemsApi.get(params);
}

export async function getItemById(id: string) {
  return itemsApi.getById(id);
}

export async function getPapers(params?: Record<string, string>) {
  return papersApi.list(params);
}

export async function getPendingReviews() {
  return itemsApi.getPending();
}

export async function getLookup(table: string) {
  return lookupApi.getTable(table);
}

export async function compareQP(data: FormData) {
  return fetch('/api/wizard/compare-qp', {
    method: 'POST',
    headers: {
      'x-user-role': localStorage.getItem('qbank_role') || 'author',
      'x-user-id': localStorage.getItem('qbank_user_id') || '1',
    },
    body: data,
  });
}

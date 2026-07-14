import React, { useState, useEffect } from 'react';

interface FilterState {
  year: string;
  grade: string;
  subject: string;
  paper: string;
  language: string;
}

interface DashboardRow {
  paper_code: string;
  subject_name: string;
  subject_alpha_code: string;
  paper_no: number;
  paper_name: string;
  year_value: number;
  grade_number: number;
  language_name: string;
  parsed: {
    qp_items: number;
    memo_items: number;
    headers: number;
  };
  database: {
    qp_items: number;
    memo_items: number;
    attachments: number;
    mcq_count?: number;
  };
  import_status: 'complete' | 'partial' | 'missing';
}

interface SummaryData {
  total_papers: number;
  complete: number;
  partial: number;
  missing: number;
  total_parsed_qp: number;
  total_parsed_memo: number;
  total_db_qp: number;
  total_db_memo: number;
}

const ParserImportDashboard: React.FC = () => {
  const [filters, setFilters] = useState<FilterState>({
    year: '',
    grade: '',
    subject: '',
    paper: '',
    language: ''
  });
  
  const [filterOptions, setFilterOptions] = useState<any>({});
  const [data, setData] = useState<DashboardRow[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch filter options on mount
  useEffect(() => {
    fetch('/api/dashboard/parser/filters')
      .then(r => r.json())
      .then(res => {
        if (res.success) setFilterOptions(res.data);
      })
      .catch(err => console.error('Failed to load filters:', err));
  }, []);

  // Fetch dashboard data when filters change
  useEffect(() => {
    fetchData();
  }, [filters.year, filters.grade, filters.subject, filters.paper, filters.language]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filters.year) params.append('year', filters.year);
      if (filters.grade) params.append('grade', filters.grade);
      if (filters.subject) params.append('subject', filters.subject);
      if (filters.paper) params.append('paper', filters.paper);
      if (filters.language) params.append('language', filters.language);
      
      const response = await fetch(`/api/dashboard/parser/parser-import-status?${params}`);
      const result = await response.json();
      
      if (!result.success) throw new Error(result.error);
      
      setData(result.data);
      setSummary(result.summary);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete': return '#22c55e';
      case 'partial': return '#f59e0b';
      case 'missing': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'complete': return 'Complete';
      case 'partial': return 'Partial';
      case 'missing': return 'Missing';
      default: return 'Unknown';
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Left Sidebar - Filters */}
      <div style={{ width: '280px', background: '#f8fafc', borderRight: '1px solid #e2e8f0', padding: '24px', overflowY: 'auto' }}>
        <h2 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>Filters</h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>Year</label>
            <select 
              value={filters.year} 
              onChange={e => handleFilterChange('year', e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px' }}
            >
              <option value="">All Years</option>
              {filterOptions.years?.map((y: any) => (
                <option key={y.year_id} value={y.year_id}>{y.year_value}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>Grade</label>
            <select 
              value={filters.grade} 
              onChange={e => handleFilterChange('grade', e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px' }}
            >
              <option value="">All Grades</option>
              {filterOptions.grades?.map((g: any) => (
                <option key={g.grade_id} value={g.grade_id}>Grade {g.grade_number}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>Subject</label>
            <select 
              value={filters.subject} 
              onChange={e => handleFilterChange('subject', e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px' }}
            >
              <option value="">All Subjects</option>
              {filterOptions.subjects?.map((s: any) => (
                <option key={s.subject_id} value={s.subject_id}>{s.subject_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>Paper</label>
            <select 
              value={filters.paper} 
              onChange={e => handleFilterChange('paper', e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px' }}
            >
              <option value="">All Papers</option>
              {filterOptions.papers?.map((p: any) => (
                <option key={p.paper_id} value={p.paper_id}>P{p.paper_no}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>Language</label>
            <select 
              value={filters.language} 
              onChange={e => handleFilterChange('language', e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px' }}
            >
              <option value="">All Languages</option>
              {filterOptions.languages?.map((l: any) => (
                <option key={l.language_id} value={l.language_id}>{l.language_name}</option>
              ))}
            </select>
          </div>
        </div>

        <button 
          onClick={() => setFilters({ year: '', grade: '', subject: '', paper: '', language: '' })}
          style={{ marginTop: '20px', width: '100%', padding: '10px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' }}
        >
          Clear Filters
        </button>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: '24px', overflowY: 'auto', background: '#ffffff' }}>
        <h1 style={{ margin: '0 0 24px 0', fontSize: '24px', fontWeight: 700, color: '#1e293b' }}>Parser Import Dashboard</h1>

        {/* Summary Cards */}
        {summary && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '16px', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#166534', textTransform: 'uppercase' }}>Complete</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#16a34a' }}>{summary.complete}</div>
            </div>
            <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: '16px', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#92400e', textTransform: 'uppercase' }}>Partial</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#d97706' }}>{summary.partial}</div>
            </div>
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '16px', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#991b1b', textTransform: 'uppercase' }}>Missing</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#dc2626' }}>{summary.missing}</div>
            </div>
            <div style={{ background: '#eff6ff', border: '1px solid #dbeafe', padding: '16px', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#1e40af', textTransform: 'uppercase' }}>Total Papers</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#3b82f6' }}>{summary.total_papers}</div>
            </div>
          </div>
        )}

        {/* Totals Row */}
        {summary && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: '#64748b' }}>QP Parsed â†’ DB</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#334155' }}>
                {summary.total_parsed_qp} â†’ {summary.total_db_qp}
              </div>
            </div>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Memo Parsed â†’ DB</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#334155' }}>
                {summary.total_parsed_memo} â†’ {summary.total_db_memo}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px', borderRadius: '6px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Loading...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Subject</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Paper</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Year</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Grade</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Language</th>
                  <th style={{ padding: '12px', textAlign: 'center', fontWeight: 600, color: '#475569' }}>QP Parsed</th>
                  <th style={{ padding: '12px', textAlign: 'center', fontWeight: 600, color: '#475569' }}>QP DB</th>
                  <th style={{ padding: '12px', textAlign: 'center', fontWeight: 600, color: '#475569' }}>Memo Parsed</th>
                  <th style={{ padding: '12px', textAlign: 'center', fontWeight: 600, color: '#475569' }}>Memo DB</th>
                  <th style={{ padding: '12px', textAlign: 'center', fontWeight: 600, color: '#475569' }}>Attach DB</th>
                  <th style={{ padding: '12px', textAlign: 'center', fontWeight: 600, color: '#475569' }}>MCQs</th>
                  <th style={{ padding: '12px', textAlign: 'center', fontWeight: 600, color: '#475569' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, index) => (
                  <tr key={row.paper_code} style={{ 
                    borderBottom: '1px solid #f1f5f9',
                    background: index % 2 === 0 ? '#ffffff' : '#f8fafc'
                  }}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{row.subject_name}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{row.subject_alpha_code}</div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 600 }}>P{row.paper_no}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{row.paper_name}</div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>{row.year_value}</td>
                    <td style={{ padding: '10px 12px' }}>Grade {row.grade_number}</td>
                    <td style={{ padding: '10px 12px' }}>{row.language_name}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: '#3b82f6' }}>{row.parsed.qp_items}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: row.database.qp_items >= row.parsed.qp_items ? '#22c55e' : '#ef4444' }}>
                      {row.database.qp_items}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: '#8b5cf6' }}>{row.parsed.memo_items}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: row.database.memo_items >= row.parsed.memo_items ? '#22c55e' : '#ef4444' }}>
                      {row.database.memo_items}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>{row.database.attachments}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: '#3b82f6' }}>{row.database.mcq_count || 0}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span style={{ 
                        display: 'inline-block',
                        padding: '4px 12px', 
                        borderRadius: '12px', 
                        fontSize: '11px', 
                        fontWeight: 600,
                        background: getStatusColor(row.import_status) + '20',
                        color: getStatusColor(row.import_status)
                      }}>
                        {getStatusLabel(row.import_status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ParserImportDashboard;

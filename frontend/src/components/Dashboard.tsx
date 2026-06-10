import React, { useState, useEffect } from 'react';

interface PaperSummary {
  paper_code: string;
  subject: string;
  subject_name: string;
  paper: string;
  year: string;
  session: string;
  file_name: string;
  latest_session_id: string;
  status: string;
  created_at: string;
  expected_items: number;
  expected_marks: number;
  parsed_items: number;
  auto_corrected: number;
  manual_review: number;
  missing_items: number;
  has_memo: boolean;
}

interface DashboardStats {
  total_papers: number;
  total_sessions: number;
  total_expected_items: number;
  total_expected_marks: number;
  total_parsed_items: number;
  auto_corrected: number;
  manual_review: number;
}

const Dashboard: React.FC = () => {
  const [papers, setPapers] = useState<PaperSummary[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterPaper, setFilterPaper] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [papersRes, statsRes] = await Promise.all([
        fetch('http://localhost:4000/api/dashboard/papers'),
        fetch('http://localhost:4000/api/dashboard/stats')
      ]);

      if (!papersRes.ok) throw new Error('Failed to load papers');
      if (!statsRes.ok) throw new Error('Failed to load stats');

      const papersData = await papersRes.json();
      const statsData = await statsRes.json();

      if (papersData.success) {
        // Convert string numbers to actual numbers
        const normalized = papersData.papers.map((p: any) => ({
          ...p,
          expected_items: parseInt(p.expected_items) || 0,
          expected_marks: parseInt(p.expected_marks) || 0,
          parsed_items: parseInt(p.parsed_items) || 0,
          auto_corrected: parseInt(p.auto_corrected) || 0,
          manual_review: parseInt(p.manual_review) || 0,
          missing_items: parseInt(p.missing_items) || 0,
        }));
        setPapers(normalized);
      }
      if (statsData.success) {
        setStats({
          total_papers: parseInt(statsData.stats.total_papers) || 0,
          total_sessions: parseInt(statsData.stats.total_sessions) || 0,
          total_expected_items: parseInt(statsData.stats.total_expected_items) || 0,
          total_expected_marks: parseInt(statsData.stats.total_expected_marks) || 0,
          total_parsed_items: parseInt(statsData.stats.total_parsed_items) || 0,
          auto_corrected: parseInt(statsData.stats.auto_corrected) || 0,
          manual_review: parseInt(statsData.stats.manual_review) || 0,
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredPapers = papers.filter(p => {
    const matchSubject = !filterSubject || p.subject === filterSubject;
    const matchYear = !filterYear || p.year === filterYear;
    const matchPaper = !filterPaper || p.paper === filterPaper;
    return matchSubject && matchYear && matchPaper;
  });

  const subjects = Array.from(new Set(papers.map(p => p.subject))).sort();
  const years = Array.from(new Set(papers.map(p => p.year))).sort();
  const papers_list = Array.from(new Set(papers.map(p => p.paper))).sort();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#27ae60';
      case 'reviewing': return '#f39c12';
      case 'comparing': return '#3498db';
      case 'auto_corrected': return '#9b59b6';
      case 'parsing': return '#95a5a6';
      case 'failed': return '#e74c3c';
      default: return '#7f8c8d';
    }
  };

  const missingMemos = papers.filter(p => !p.has_memo).length;
  const needReview = papers.filter(p => p.manual_review > 0).length;

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>📊 QBank Paper Upload Dashboard</h1>
        <p>Track all uploaded Question Papers and Memos</p>
      </div>

      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-number">{stats.total_papers}</div>
            <div className="stat-label">Unique Papers</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{stats.total_sessions}</div>
            <div className="stat-label">Total Sessions</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{stats.total_expected_items}</div>
            <div className="stat-label">QP Items</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{stats.total_expected_marks}</div>
            <div className="stat-label">Total Marks</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{stats.total_parsed_items}</div>
            <div className="stat-label">Parsed Items</div>
          </div>
          <div className="stat-card" style={{borderLeft: '4px solid #e74c3c'}}>
            <div className="stat-number" style={{color: '#e74c3c'}}>{missingMemos}</div>
            <div className="stat-label">Missing Memos</div>
          </div>
        </div>
      )}

      <div className="filters">
        <div className="filter-group">
          <label>Subject:</label>
          <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}>
            <option value="">All Subjects</option>
            {subjects.map(s => {
              const paper = papers.find(p => p.subject === s);
              return <option key={s} value={s}>{paper?.subject_name || s}</option>;
            })}
          </select>
        </div>
        <div className="filter-group">
          <label>Year:</label>
          <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
            <option value="">All Years</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>Paper:</label>
          <select value={filterPaper} onChange={(e) => setFilterPaper(e.target.value)}>
            <option value="">All Papers</option>
            {papers_list.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <button className="btn-refresh" onClick={fetchData}>🔄 Refresh</button>
      </div>

      {error && <div className="error-banner">❌ {error}</div>}
      {loading && <div className="loading">⏳ Loading dashboard...</div>}

      {!loading && (
        <div className="table-container">
          <table className="papers-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Subject</th>
                <th>Paper</th>
                <th>Year</th>
                <th>Session</th>
                <th>QP Items</th>
                <th>Marks</th>
                <th>Parsed</th>
                <th>Memo</th>
                <th>Status</th>
                <th>Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {filteredPapers.map((paper, index) => (
                <tr key={paper.paper_code} className={!paper.has_memo ? 'missing-memo' : ''}>
                  <td>{index + 1}</td>
                  <td><strong>{paper.subject_name}</strong></td>
                  <td>{paper.paper}</td>
                  <td>{paper.year}</td>
                  <td>{paper.session}</td>
                  <td>
                    <span className="badge" style={{background: '#3498db'}}>
                      {paper.expected_items}
                    </span>
                  </td>
                  <td>
                    <span className="badge" style={{background: '#9b59b6'}}>
                      {paper.expected_marks}
                    </span>
                  </td>
                  <td>
                    <span className="badge" style={{background: paper.parsed_items > 0 ? '#27ae60' : '#e74c3c'}}>
                      {paper.parsed_items}
                    </span>
                  </td>
                  <td>
                    {paper.has_memo ? (
                      <span className="badge" style={{background: '#27ae60'}}>✅ Loaded</span>
                    ) : (
                      <span className="badge" style={{background: '#e74c3c'}}>❌ Missing</span>
                    )}
                  </td>
                  <td>
                    <span className="status-badge" style={{background: getStatusColor(paper.status)}}>
                      {paper.status}
                    </span>
                  </td>
                  <td>{new Date(paper.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredPapers.length === 0 && (
            <div className="no-data">📭 No papers found. Upload some papers first!</div>
          )}
        </div>
      )}

      {!loading && filteredPapers.length > 0 && (
        <div className="summary-footer">
          <p>
            <strong>Showing {filteredPapers.length} of {papers.length} papers</strong>
            {' | '}
            <span style={{color: '#e74c3c', fontWeight: 'bold'}}>
              ⚠️ {missingMemos} papers missing memos
            </span>
            {needReview > 0 && (
              <>
                {' | '}
                <span style={{color: '#f39c12', fontWeight: 'bold'}}>
                  ⚠️ {needReview} papers need review
                </span>
              </>
            )}
          </p>
        </div>
      )}

      <style>{`{
        .dashboard {
          max-width: 1400px;
          margin: 0 auto;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .dashboard-header {
          background: #1a1a2e;
          color: white;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .dashboard-header h1 {
          margin: 0 0 5px 0;
          font-size: 24px;
        }
        .dashboard-header p {
          margin: 0;
          opacity: 0.8;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 15px;
          margin-bottom: 20px;
        }
        .stat-card {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 15px;
          text-align: center;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .stat-number {
          font-size: 28px;
          font-weight: bold;
          color: #1a1a2e;
        }
        .stat-label {
          font-size: 12px;
          color: #666;
          margin-top: 5px;
        }
        .filters {
          display: flex;
          gap: 15px;
          margin-bottom: 20px;
          background: #f8f9fa;
          padding: 15px;
          border-radius: 8px;
          align-items: center;
        }
        .filter-group {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .filter-group label {
          font-size: 12px;
          font-weight: 600;
          color: #555;
        }
        .filter-group select {
          padding: 6px 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          min-width: 150px;
        }
        .btn-refresh {
          background: #3498db;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          margin-left: auto;
        }
        .btn-refresh:hover {
          background: #2980b9;
        }
        .error-banner {
          background: #f8d7da;
          color: #721c24;
          padding: 12px;
          border-radius: 6px;
          margin-bottom: 20px;
        }
        .loading {
          text-align: center;
          padding: 40px;
          font-size: 16px;
          color: #666;
        }
        .table-container {
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .papers-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .papers-table thead {
          background: #1a1a2e;
          color: white;
        }
        .papers-table th {
          padding: 12px;
          text-align: left;
          font-weight: 600;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .papers-table td {
          padding: 10px 12px;
          border-bottom: 1px solid #f0f0f0;
        }
        .papers-table tr:hover {
          background: #f8f9fa;
        }
        .papers-table tr.missing-memo {
          background: #fff5f5;
        }
        .papers-table tr.missing-memo:hover {
          background: #ffe0e0;
        }
        .badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 12px;
          color: white;
          font-size: 11px;
          font-weight: 600;
        }
        .status-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 12px;
          color: white;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
        }
        .no-data {
          text-align: center;
          padding: 60px;
          color: #666;
          font-size: 16px;
        }
        .summary-footer {
          margin-top: 20px;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 8px;
          text-align: center;
        }
        .summary-footer p {
          margin: 0;
          font-size: 14px;
        }
      }`}</style>
    </div>
  );
};

export default Dashboard;

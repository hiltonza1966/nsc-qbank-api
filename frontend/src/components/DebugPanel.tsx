import React, { useState, useEffect, useRef, useCallback } from 'react';

interface LogEntry {
  timestamp: string;
  level: string;
  section: string;
  message: string;
  data?: any;
}

interface LogStats {
  total: number;
  byLevel: Record<string, number>;
  bySection: Record<string, number>;
  recentErrors: LogEntry[];
  recentApiErrors: LogEntry[];
}

const LEVEL_COLORS: Record<string, string> = {
  ERROR: '#ff4444',
  WARN: '#ffaa00',
  INFO: '#00aa00',
  API: '#0088ff',
  DB: '#aa00ff',
  FRONTEND: '#ff00aa',
  RESPONSE: '#00aaaa',
  REQUEST: '#8888ff',
  UNHANDLED_REJECTION: '#ff0000',
  UNCAUGHT_EXCEPTION: '#ff0000',
  EXPRESS_ERROR: '#ff4444',
};

const SECTION_COLORS: Record<string, string> = {
  ERROR: '#ff4444',
  REQUEST: '#8888ff',
  RESPONSE: '#00aaaa',
  DB: '#aa00ff',
  FRONTEND: '#ff00aa',
  EXPRESS_ERROR: '#ff4444',
  UNHANDLED_REJECTION: '#ff0000',
  UNCAUGHT_EXCEPTION: '#ff0000',
};

export default function DebugPanel() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [filter, setFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [frontendErrors, setFrontendErrors] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const API_BASE = 'http://localhost:4000';

  // Fetch logs from backend
  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filter) params.append('filter', filter);
      if (levelFilter) params.append('level', levelFilter);
      if (sectionFilter) params.append('section', sectionFilter);
      params.append('limit', '500');

      const res = await fetch(`${API_BASE}/api/debug/logs?${params}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs);
      }
    } catch (err) {
      console.error('Debug panel fetch failed:', err);
    }
  }, [filter, levelFilter, sectionFilter, API_BASE]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/debug/stats`);
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Debug stats fetch failed:', err);
    }
  }, [API_BASE]);

  // Auto refresh
  useEffect(() => {
    if (autoRefresh && isOpen) {
      fetchLogs();
      fetchStats();
      intervalRef.current = setInterval(() => {
        fetchLogs();
        fetchStats();
      }, 3000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, isOpen, fetchLogs, fetchStats]);

  // Capture frontend errors globally
  useEffect(() => {
    const errors: any[] = [];

    const originalError = console.error;
    console.error = (...args: any[]) => {
      errors.push({ type: 'console.error', timestamp: new Date().toISOString(), args: args.map(a => String(a)).join(' ') });
      setFrontendErrors(prev => [...prev.slice(-50), { type: 'console.error', timestamp: new Date().toISOString(), args: args.map(a => String(a)).join(' ') }]);
      originalError.apply(console, args);
    };

    const handleError = (event: ErrorEvent) => {
      const entry = {
        type: 'window.error',
        timestamp: new Date().toISOString(),
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.toString()
      };
      errors.push(entry);
      setFrontendErrors(prev => [...prev.slice(-50), entry]);
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const entry = {
        type: 'unhandledrejection',
        timestamp: new Date().toISOString(),
        reason: String(event.reason)
      };
      errors.push(entry);
      setFrontendErrors(prev => [...prev.slice(-50), entry]);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    // Intercept fetch to log API errors
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch.apply(window, args);
        if (!response.ok) {
          const entry = {
            type: 'fetch.error',
            timestamp: new Date().toISOString(),
            url: args[0],
            status: response.status,
            statusText: response.statusText
          };
          setFrontendErrors(prev => [...prev.slice(-50), entry]);
        }
        return response;
      } catch (err) {
        const entry = {
          type: 'fetch.exception',
          timestamp: new Date().toISOString(),
          url: args[0],
          error: String(err)
        };
        setFrontendErrors(prev => [...prev.slice(-50), entry]);
        throw err;
      }
    };

    return () => {
      console.error = originalError;
      window.fetch = originalFetch;
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  const clearLogs = async () => {
    try {
      await fetch(`${API_BASE}/api/debug/clear`, { method: 'POST' });
      fetchLogs();
    } catch (err) {
      console.error('Failed to clear logs:', err);
    }
  };

  const toggleRow = (index: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const exportLogs = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const allSections = Array.from(new Set(logs.map(l => l.section))).sort();
  const allLevels = Array.from(new Set(logs.map(l => l.level))).sort();

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 99999,
          background: '#ff4444',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          width: '50px',
          height: '50px',
          fontSize: '20px',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        title="Open Debug Panel"
      >
        ðŸ›
      </button>
    );
  }

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        top: '10px',
        left: '10px',
        right: '10px',
        bottom: '10px',
        zIndex: 99999,
        background: '#1a1a2e',
        color: '#eee',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'monospace',
        fontSize: '12px',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #333', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, color: '#00ff88' }}>ðŸ› System Debug Panel</h3>

        <input
          type="text"
          placeholder="Filter logs..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #444', background: '#222', color: '#fff', width: '150px' }}
        />

        <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)} style={{ padding: '4px', borderRadius: '4px', background: '#222', color: '#fff', border: '1px solid #444' }}>
          <option value="">All Levels</option>
          {allLevels.map(l => <option key={l} value={l}>{l}</option>)}
        </select>

        <select value={sectionFilter} onChange={e => setSectionFilter(e.target.value)} style={{ padding: '4px', borderRadius: '4px', background: '#222', color: '#fff', border: '1px solid #444' }}>
          <option value="">All Sections</option>
          {allSections.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
          <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
          Auto-refresh (3s)
        </label>

        <button onClick={fetchLogs} style={{ padding: '4px 12px', borderRadius: '4px', background: '#0066cc', color: 'white', border: 'none', cursor: 'pointer' }}>
          Refresh
        </button>
        <button onClick={clearLogs} style={{ padding: '4px 12px', borderRadius: '4px', background: '#cc3300', color: 'white', border: 'none', cursor: 'pointer' }}>
          Clear
        </button>
        <button onClick={exportLogs} style={{ padding: '4px 12px', borderRadius: '4px', background: '#008800', color: 'white', border: 'none', cursor: 'pointer' }}>
          Export JSON
        </button>
        <button onClick={() => setIsOpen(false)} style={{ padding: '4px 12px', borderRadius: '4px', background: '#666', color: 'white', border: 'none', cursor: 'pointer', marginLeft: 'auto' }}>
          Close âœ•
        </button>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div style={{ padding: '8px 16px', borderBottom: '1px solid #333', display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '11px' }}>
          <span>Total: <strong>{stats.total}</strong></span>
          {Object.entries(stats.byLevel).map(([level, count]) => (
            <span key={level} style={{ color: LEVEL_COLORS[level] || '#fff' }}>
              {level}: <strong>{count}</strong>
            </span>
          ))}
          {stats.recentErrors.length > 0 && (
            <span style={{ color: '#ff4444', fontWeight: 'bold' }}>
              âš ï¸ Recent Errors: {stats.recentErrors.length}
            </span>
          )}
        </div>
      )}

      {/* Frontend Errors */}
      {frontendErrors.length > 0 && (
        <div style={{ padding: '8px 16px', borderBottom: '1px solid #ff4444', background: 'rgba(255,68,68,0.1)', maxHeight: '120px', overflow: 'auto' }}>
          <div style={{ color: '#ff4444', fontWeight: 'bold', marginBottom: '4px' }}>ðŸŒ Frontend Errors ({frontendErrors.length}):</div>
          {frontendErrors.slice(-5).map((err, i) => (
            <div key={i} style={{ fontSize: '11px', color: '#ff8888', marginBottom: '2px' }}>
              [{err.timestamp?.split('T')[1]?.slice(0, 8) || '???'}] {err.type}: {err.message || err.args || err.reason || err.status || err.error || JSON.stringify(err).slice(0, 100)}
            </div>
          ))}
        </div>
      )}

      {/* Log Table */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead style={{ position: 'sticky', top: 0, background: '#16213e', zIndex: 10 }}>
            <tr>
              <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #333', width: '80px' }}>Time</th>
              <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #333', width: '60px' }}>Level</th>
              <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #333', width: '100px' }}>Section</th>
              <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #333' }}>Message</th>
              <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #333', width: '40px' }}>Data</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                  No logs found. Start the backend and make some API calls.
                </td>
              </tr>
            )}
            {logs.map((log, index) => {
              const isExpanded = expandedRows.has(index);
              const levelColor = LEVEL_COLORS[log.level] || '#fff';
              const sectionColor = SECTION_COLORS[log.section] || '#aaa';

              return (
                <React.Fragment key={index}>
                  <tr 
                    onClick={() => toggleRow(index)}
                    style={{ 
                      cursor: 'pointer',
                      borderBottom: '1px solid #222',
                      background: index % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'
                    }}
                  >
                    <td style={{ padding: '4px 8px', color: '#888', whiteSpace: 'nowrap' }}>
                      {log.timestamp?.split('T')[1]?.slice(0, 12) || '???'}
                    </td>
                    <td style={{ padding: '4px 8px', color: levelColor, fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                      {log.level}
                    </td>
                    <td style={{ padding: '4px 8px', color: sectionColor, whiteSpace: 'nowrap' }}>
                      {log.section}
                    </td>
                    <td style={{ padding: '4px 8px', color: '#ddd', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.message}
                    </td>
                    <td style={{ padding: '4px 8px', color: '#888', textAlign: 'center' }}>
                      {log.data ? (isExpanded ? 'â–¼' : 'â–¶') : '-'}
                    </td>
                  </tr>
                  {isExpanded && log.data && (
                    <tr>
                      <td colSpan={5} style={{ padding: '8px 16px', background: '#0f0f23', borderBottom: '1px solid #333' }}>
                        <pre style={{ margin: 0, color: '#88ff88', fontSize: '11px', overflow: 'auto', maxHeight: '300px' }}>
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div style={{ padding: '8px 16px', borderTop: '1px solid #333', display: 'flex', justifyContent: 'space-between', color: '#666', fontSize: '11px' }}>
        <span>Showing {logs.length} logs</span>
        <span>QBank Debug System v2.0</span>
      </div>
    </div>
  );
}

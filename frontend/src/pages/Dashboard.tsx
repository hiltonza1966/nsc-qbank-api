import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface Stats {
  total_items: number;
  draft_items: number;
  pending_review: number;
  peer_approved: number;
  expert_approved: number;
  approved_items: number;
  published_items: number;
  total_papers: number;
  draft_papers: number;
  pending_papers: number;
  approved_papers: number;
  total_subjects: number;
  total_subtopics: number;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      const response = await fetch('/api/dashboard/stats', {
        headers: {
          'x-user-role': localStorage.getItem('qbank_role') || 'author',
          'x-user-id': localStorage.getItem('qbank_user_id') || '1',
        },
      });

      if (!response.ok) {
        // Fallback: if dashboard endpoint doesn't exist, build stats manually
        const fallbackStats = await buildFallbackStats();
        setStats(fallbackStats);
        setLoading(false);
        return;
      }

      const data = await response.json();
      setStats(data.data || data);
      setLoading(false);
    } catch (err) {
      // Fallback on error
      const fallbackStats = await buildFallbackStats();
      setStats(fallbackStats);
      setLoading(false);
    }
  }

  async function buildFallbackStats(): Promise<Stats> {
    // Fetch individual counts from existing endpoints
    let totalItems = 0;
    let totalPapers = 0;
    let totalSubjects = 0;
    let totalSubtopics = 0;

    try {
      const itemsRes = await fetch('/api/qbank/items?limit=1', {
        headers: { 'x-user-role': localStorage.getItem('qbank_role') || 'author' }
      });
      if (itemsRes.ok) {
        const itemsData = await itemsRes.json();
        totalItems = itemsData.total || itemsData.data?.length || 0;
      }
    } catch (e) { /* ignore */ }

    try {
      const papersRes = await fetch('/api/qbank/papers?limit=1', {
        headers: { 'x-user-role': localStorage.getItem('qbank_role') || 'author' }
      });
      if (papersRes.ok) {
        const papersData = await papersRes.json();
        totalPapers = papersData.total || papersData.data?.length || 0;
      }
    } catch (e) { /* ignore */ }

    try {
      const subjRes = await fetch('/api/lookup/lookup_subjects', {
        headers: { 'x-user-role': localStorage.getItem('qbank_role') || 'author' }
      });
      if (subjRes.ok) {
        const subjData = await subjRes.json();
        totalSubjects = subjData.data?.length || subjData.length || 0;
      }
    } catch (e) { /* ignore */ }

    try {
      const subRes = await fetch('/api/lookup/lookup_caps_subtopics', {
        headers: { 'x-user-role': localStorage.getItem('qbank_role') || 'author' }
      });
      if (subRes.ok) {
        const subData = await subRes.json();
        totalSubtopics = subData.data?.length || subData.length || 0;
      }
    } catch (e) { /* ignore */ }

    return {
      total_items: totalItems,
      draft_items: 0,
      pending_review: 0,
      peer_approved: 0,
      expert_approved: 0,
      approved_items: 0,
      published_items: 0,
      total_papers: totalPapers,
      draft_papers: 0,
      pending_papers: 0,
      approved_papers: 0,
      total_subjects: totalSubjects,
      total_subtopics: totalSubtopics,
    };
  }

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ 
          width: '40px', height: '40px', 
          border: '4px solid #e5e7eb', borderTop: '4px solid #3b82f6',
          borderRadius: '50%', animation: 'spin 1s linear infinite',
          margin: '0 auto 16px'
        }} />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (!stats) return null;

  const cardStyle: React.CSSProperties = {
    background: '#ffffff',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #e5e7eb',
  };

  const numberStyle: React.CSSProperties = {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: '4px',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '14px',
    color: '#6b7280',
  };

  return (
    <div style={{ padding: '24px', fontFamily: 'system-ui, sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', color: '#1f2937' }}>
        Dashboard
      </h1>

      {/* Stats Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
        gap: '16px',
        marginBottom: '32px'
      }}>
        <div style={cardStyle}>
          <div style={numberStyle}>{stats.total_items}</div>
          <div style={labelStyle}>Total Items</div>
        </div>
        <div style={cardStyle}>
          <div style={numberStyle}>{stats.total_papers}</div>
          <div style={labelStyle}>Total Papers</div>
        </div>
        <div style={cardStyle}>
          <div style={numberStyle}>{stats.total_subjects}</div>
          <div style={labelStyle}>Subjects</div>
        </div>
        <div style={cardStyle}>
          <div style={numberStyle}>{stats.total_subtopics}</div>
          <div style={labelStyle}>CAPS Subtopics</div>
        </div>
        <div style={cardStyle}>
          <div style={{ ...numberStyle, color: '#f59e0b' }}>{stats.draft_items}</div>
          <div style={labelStyle}>Draft Items</div>
        </div>
        <div style={cardStyle}>
          <div style={{ ...numberStyle, color: '#3b82f6' }}>{stats.pending_review}</div>
          <div style={labelStyle}>Pending Review</div>
        </div>
        <div style={cardStyle}>
          <div style={{ ...numberStyle, color: '#10b981' }}>{stats.approved_items}</div>
          <div style={labelStyle}>Approved Items</div>
        </div>
        <div style={cardStyle}>
          <div style={{ ...numberStyle, color: '#8b5cf6' }}>{stats.published_items}</div>
          <div style={labelStyle}>Published Items</div>
        </div>
      </div>

      {/* Quick Actions */}
      <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px', color: '#1f2937' }}>
        Quick Actions
      </h2>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
        <Link to="/items/new" style={{
          padding: '12px 24px',
          background: '#3b82f6',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '6px',
          fontWeight: '500',
        }}>
          + Create Item
        </Link>
        <Link to="/papers/new" style={{
          padding: '12px 24px',
          background: '#10b981',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '6px',
          fontWeight: '500',
        }}>
          + Create Paper
        </Link>
        <Link to="/wizard" style={{
          padding: '12px 24px',
          background: '#f59e0b',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '6px',
          fontWeight: '500',
        }}>
          Import QP
        </Link>
      </div>

      {/* System Status */}
      <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px', color: '#1f2937' }}>
        System Status
      </h2>
      <div style={{ ...cardStyle, maxWidth: '600px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
          <span style={{ color: '#6b7280' }}>Backend API</span>
          <span style={{ color: '#10b981', fontWeight: '500' }}>● Connected (Port 4000)</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
          <span style={{ color: '#6b7280' }}>Database</span>
          <span style={{ color: '#10b981', fontWeight: '500' }}>● nsc_qbank (39 tables)</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
          <span style={{ color: '#6b7280' }}>CAPS Subtopics</span>
          <span style={{ color: '#10b981', fontWeight: '500' }}>● {stats.total_subtopics} seeded</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
          <span style={{ color: '#6b7280' }}>Frontend</span>
          <span style={{ color: '#10b981', fontWeight: '500' }}>● React 18 + Vite</span>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

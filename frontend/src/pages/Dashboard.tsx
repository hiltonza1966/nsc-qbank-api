import React, { useState, useEffect } from 'react';

interface DashboardStats {
  totalItems: number;
  totalPapers: number;
  totalTemplates: number;
  totalSubjects: number;
  totalTopics: number;
  totalSubtopics: number;
  itemsByStatus: Record<string, number>;
  papersByStatus: Record<string, number>;
  itemsByBody: Array<{ assessment_body_name: string; assessment_origin: string; count: number }>;
  itemsByYear: Array<{ year_value: number; count: number }>;
  itemsByGrade: Array<{ grade_number: number; grade_name: string; count: number }>;
  itemsBySubject: Array<{ subject_alpha_code: string; subject_name: string; count: number }>;
  itemsByPaper: Array<{ paper_no: number; paper_name: string; count: number }>;
  recentPapers: Array<any>;
  recentItems: Array<any>;
  recentWorkflow: Array<any>;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('http://localhost:4000/api/dashboard/stats');
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      } else {
        setError(data.message);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading dashboard...</div>;
  if (error) return <div style={{ padding: '40px', color: 'red' }}>Error: {error}</div>;
  if (!stats) return <div style={{ padding: '40px' }}>No data available</div>;

  const statusColors: Record<string, string> = {
    draft: '#f59e0b',
    pending_review: '#3b82f6',
    revision_required: '#ef4444',
    peer_approved: '#8b5cf6',
    expert_approved: '#06b6d4',
    moderated: '#10b981',
    published: '#22c55e',
    archived: '#6b7280',
    assembled: '#3b82f6',
    internal_moderated: '#8b5cf6',
    external_moderated: '#06b6d4',
    dbe_approval: '#f59e0b',
    print_ready: '#10b981',
    reviewed: '#3b82f6',
    approved: '#22c55e'
  };

  const StatCard = ({ title, value, subtitle, color }: { title: string; value: number; subtitle?: string; color: string }) => (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      borderLeft: `4px solid ${color}`,
      minWidth: '160px'
    }}>
      <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>{title}</div>
      <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1f2937', marginBottom: '4px' }}>{value.toLocaleString()}</div>
      {subtitle && <div style={{ fontSize: '12px', color: '#9ca3af' }}>{subtitle}</div>}
    </div>
  );

  const SectionTitle = ({ title, icon }: { title: string; icon: string }) => (
    <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span>{icon}</span> {title}
    </h2>
  );

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1f2937', marginBottom: '24px' }}>QBank Dashboard</h1>

      {/* TOP STATS ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <StatCard title="Total Items" value={stats.totalItems} color="#3b82f6" />
        <StatCard title="Papers" value={stats.totalPapers} color="#8b5cf6" />
        <StatCard title="Templates" value={stats.totalTemplates} color="#06b6d4" />
        <StatCard title="Subjects" value={stats.totalSubjects} color="#f59e0b" />
        <StatCard title="CAPS Topics" value={stats.totalTopics} color="#10b981" />
        <StatCard title="CAPS Subtopics" value={stats.totalSubtopics} color="#ef4444" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
        {/* ITEMS BY STATUS */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <SectionTitle title="Items by Status" icon="📊" />
          {Object.entries(stats.itemsByStatus).length === 0 ? (
            <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>No items in database</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {Object.entries(stats.itemsByStatus).map(([status, count]) => (
                <div key={status} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '12px', height: '12px', borderRadius: '50%',
                      background: statusColors[status] || '#6b7280'
                    }} />
                    <span style={{ fontSize: '14px', color: '#374151', textTransform: 'capitalize' }}>{status.replace(/_/g, ' ')}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      height: '8px', borderRadius: '4px',
                      background: statusColors[status] || '#6b7280',
                      width: `${Math.max(count * 2, 20)}px`,
                      minWidth: '20px'
                    }} />
                    <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#1f2937', minWidth: '30px', textAlign: 'right' }}>{count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* PAPERS BY STATUS */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <SectionTitle title="Papers by Status" icon="📄" />
          {Object.entries(stats.papersByStatus).length === 0 ? (
            <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>No papers in database</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {Object.entries(stats.papersByStatus).map(([status, count]) => (
                <div key={status} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '12px', height: '12px', borderRadius: '50%',
                      background: statusColors[status] || '#6b7280'
                    }} />
                    <span style={{ fontSize: '14px', color: '#374151', textTransform: 'capitalize' }}>{status.replace(/_/g, ' ')}</span>
                  </div>
                  <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#1f2937' }}>{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
        {/* ITEMS BY SUBJECT */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <SectionTitle title="Items by Subject" icon="📚" />
          {stats.itemsBySubject.length === 0 ? (
            <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>No items by subject</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {stats.itemsBySubject.map((subject) => (
                <div key={subject.subject_alpha_code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <div>
                    <span style={{ fontWeight: 'bold', color: '#1f2937', fontSize: '14px' }}>{subject.subject_alpha_code}</span>
                    <span style={{ color: '#9ca3af', fontSize: '12px', marginLeft: '8px' }}>{subject.subject_name}</span>
                  </div>
                  <span style={{ fontWeight: 'bold', color: '#3b82f6', fontSize: '14px' }}>{subject.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ITEMS BY ASSESSMENT BODY */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <SectionTitle title="Items by Assessment Body" icon="🏛️" />
          {stats.itemsByBody.length === 0 ? (
            <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>No assessment body data</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {stats.itemsByBody.map((body) => (
                <div key={body.assessment_origin} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <div>
                    <span style={{ fontWeight: 'bold', color: '#1f2937', fontSize: '14px' }}>{body.assessment_origin}</span>
                    <span style={{ color: '#9ca3af', fontSize: '12px', marginLeft: '8px' }}>{body.assessment_body_name}</span>
                  </div>
                  <span style={{ fontWeight: 'bold', color: '#8b5cf6', fontSize: '14px' }}>{body.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px', marginBottom: '32px' }}>
        {/* ITEMS BY YEAR */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <SectionTitle title="Items by Year" icon="📅" />
          {stats.itemsByYear.length === 0 ? (
            <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>No year data</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {stats.itemsByYear.map((year) => (
                <div key={year.year_value} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', color: '#374151' }}>{year.year_value}</span>
                  <span style={{ fontWeight: 'bold', color: '#3b82f6', fontSize: '14px' }}>{year.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ITEMS BY GRADE */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <SectionTitle title="Items by Grade" icon="🎓" />
          {stats.itemsByGrade.length === 0 ? (
            <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>No grade data</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {stats.itemsByGrade.map((grade) => (
                <div key={grade.grade_number} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', color: '#374151' }}>{grade.grade_name}</span>
                  <span style={{ fontWeight: 'bold', color: '#10b981', fontSize: '14px' }}>{grade.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ITEMS BY PAPER */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <SectionTitle title="Items by Paper" icon="📝" />
          {stats.itemsByPaper.length === 0 ? (
            <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>No paper data</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {stats.itemsByPaper.map((paper) => (
                <div key={paper.paper_no} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', color: '#374151' }}>{paper.paper_name}</span>
                  <span style={{ fontWeight: 'bold', color: '#f59e0b', fontSize: '14px' }}>{paper.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
        {/* RECENT PAPERS */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <SectionTitle title="Recent Papers" icon="📄" />
          {stats.recentPapers.length === 0 ? (
            <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>No papers yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {stats.recentPapers.map((paper, idx) => (
                <div key={idx} style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px', fontSize: '13px' }}>
                  <div style={{ fontWeight: 'bold', color: '#1f2937', marginBottom: '4px' }}>{paper.paper_title}</div>
                  <div style={{ color: '#6b7280', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <span>{paper.assessment_origin}</span>
                    <span>{paper.year_value}</span>
                    <span>{paper.grade_name}</span>
                    <span>Paper {paper.paper_no}</span>
                    <span>{paper.total_marks} marks</span>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      background: statusColors[paper.status] + '20',
                      color: statusColors[paper.status]
                    }}>{paper.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RECENT WORKFLOW ACTIVITY */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <SectionTitle title="Recent Workflow Activity" icon="🔄" />
          {stats.recentWorkflow.length === 0 ? (
            <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>No workflow activity</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {stats.recentWorkflow.map((entry, idx) => (
                <div key={idx} style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px', fontSize: '13px' }}>
                  <div style={{ fontWeight: 'bold', color: '#1f2937', marginBottom: '4px' }}>
                    {entry.question_number || 'Unknown Item'}: {entry.previous_state} → {entry.current_state}
                  </div>
                  <div style={{ color: '#6b7280', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <span>By: {entry.changed_by_role}</span>
                    <span>{entry.transition_reason}</span>
                    <span>{new Date(entry.created_at).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '32px' }}>
        <SectionTitle title="Quick Actions" icon="⚡" />
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <a href="/items" style={{
            padding: '12px 24px',
            background: '#3b82f6',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '8px',
            fontWeight: 'bold',
            fontSize: '14px'
          }}>+ Create Item</a>
          <a href="/papers" style={{
            padding: '12px 24px',
            background: '#10b981',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '8px',
            fontWeight: 'bold',
            fontSize: '14px'
          }}>+ Create Paper</a>
          <a href="/wizard" style={{
            padding: '12px 24px',
            background: '#f59e0b',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '8px',
            fontWeight: 'bold',
            fontSize: '14px'
          }}>Import QP</a>
          <a href="/reviewer-dashboard" style={{
            padding: '12px 24px',
            background: '#8b5cf6',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '8px',
            fontWeight: 'bold',
            fontSize: '14px'
          }}>Review Items</a>
        </div>
      </div>

      {/* SYSTEM STATUS */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <SectionTitle title="System Status" icon="✅" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
            <span style={{ color: '#6b7280' }}>Backend API</span>
            <span style={{ color: '#10b981', fontWeight: 'bold' }}>Connected (Port 4000)</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
            <span style={{ color: '#6b7280' }}>Database</span>
            <span style={{ color: '#10b981', fontWeight: 'bold' }}>nsc_qbank (39 tables)</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
            <span style={{ color: '#6b7280' }}>CAPS Subtopics</span>
            <span style={{ color: '#10b981', fontWeight: 'bold' }}>Seeded</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
            <span style={{ color: '#6b7280' }}>Frontend</span>
            <span style={{ color: '#10b981', fontWeight: 'bold' }}>React 18 + Vite</span>
          </div>
        </div>
      </div>
    </div>
  );
}

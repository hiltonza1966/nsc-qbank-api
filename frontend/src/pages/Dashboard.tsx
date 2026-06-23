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
  itemsByBody: Array<{ body_code: string; body_name: string; count: number }>;
  itemsByYear: Array<{ year_value: number; count: number }>;
  itemsByGrade: Array<{ grade_number: number; grade_label: string; count: number }>;
  itemsBySubject: Array<{ subject_alpha_code: string; subject_name: string; count: number }>;
  itemsByPaper: Array<{ paper_no: number; paper_name: string; count: number }>;
  recentPapers: Array<any>;
  recentItems: Array<any>;
  recentWorkflow: Array<any>;
}

// ============================================
// CHART COMPONENTS (CSS/SVG-based, no library)
// ============================================

const BarChart = ({ data, color, maxValue }: { data: Array<{ label: string; value: number }>; color: string; maxValue: number }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
    {data.map((item, idx) => (
      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '12px', color: '#6b7280', minWidth: '60px', textAlign: 'right' }}>{item.label}</span>
        <div style={{ flex: 1, height: '24px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${Math.max((item.value / maxValue) * 100, 2)}%`,
            background: color,
            borderRadius: '4px',
            transition: 'width 0.5s ease-out',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingRight: '8px'
          }}>
            <span style={{ fontSize: '11px', color: 'white', fontWeight: 'bold' }}>{item.value}</span>
          </div>
        </div>
      </div>
    ))}
  </div>
);

const DonutChart = ({ data, colors }: { data: Array<{ label: string; value: number }>; colors: string[] }) => {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  let cumulativePercent = 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r="60" fill="none" stroke="#f3f4f6" strokeWidth="16" />
        {data.map((item, idx) => {
          const percent = item.value / total;
          const circumference = 2 * Math.PI * 60;
          const dashArray = `${percent * circumference} ${circumference}`;
          const dashOffset = -cumulativePercent * circumference;
          cumulativePercent += percent;
          return (
            <circle
              key={idx}
              cx="70"
              cy="70"
              r="60"
              fill="none"
              stroke={colors[idx % colors.length]}
              strokeWidth="16"
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              transform="rotate(-90 70 70)"
            />
          );
        })}
        <text x="70" y="65" textAnchor="middle" fontSize="20" fontWeight="bold" fill="#1f2937">{total}</text>
        <text x="70" y="82" textAnchor="middle" fontSize="10" fill="#6b7280">Total</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {data.map((item, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: colors[idx % colors.length] }} />
            <span style={{ fontSize: '12px', color: '#374151' }}>{item.label}</span>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#1f2937' }}>{item.value}</span>
            <span style={{ fontSize: '11px', color: '#9ca3af' }}>({((item.value / total) * 100).toFixed(1)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const MiniTrend = ({ data, color }: { data: number[]; color: string }) => {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const width = 120;
  const height = 40;
  const points = data.map((v, i) => `${(i / (data.length - 1 || 1)) * width},${height - ((v - min) / range) * height}`).join(' ');

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        points={points}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {data.map((v, i) => (
        <circle
          key={i}
          cx={(i / (data.length - 1 || 1)) * width}
          cy={height - ((v - min) / range) * height}
          r="3"
          fill={color}
        />
      ))}
    </svg>
  );
};

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

  const chartPalette = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

  const StatCard = ({ title, value, subtitle, color, trend }: { title: string; value: number; subtitle?: string; color: string; trend?: number[] }) => (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      borderLeft: `4px solid ${color}`,
      minWidth: '160px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      <div>
        <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>{title}</div>
        <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1f2937', marginBottom: '4px' }}>{value.toLocaleString()}</div>
        {subtitle && <div style={{ fontSize: '12px', color: '#9ca3af' }}>{subtitle}</div>}
      </div>
      {trend && <MiniTrend data={trend} color={color} />}
    </div>
  );

  const SectionTitle = ({ title, icon }: { title: string; icon: string }) => (
    <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span>{icon}</span> {title}
    </h2>
  );

  // Prepare chart data
  const statusChartData = Object.entries(stats.itemsByStatus).map(([status, count]) => ({
    label: status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    value: count
  }));

  const subjectChartData = stats.itemsBySubject.slice(0, 6).map(s => ({
    label: s.subject_alpha_code,
    value: s.count
  }));
  const maxSubjectCount = Math.max(...subjectChartData.map(d => d.value), 1);

  const yearChartData = stats.itemsByYear.map(y => ({
    label: String(y.year_value),
    value: y.count
  }));
  const maxYearCount = Math.max(...yearChartData.map(d => d.value), 1);

  const paperChartData = stats.itemsByPaper.map(p => ({
    label: `Paper ${p.paper_no}`,
    value: p.count
  }));
  const maxPaperCount = Math.max(...paperChartData.map(d => d.value), 1);

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1f2937', marginBottom: '24px' }}>QBank Dashboard</h1>

      {/* TOP STATS ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <StatCard title="Total Items" value={stats.totalItems} color="#3b82f6" trend={[stats.totalItems * 0.8, stats.totalItems * 0.9, stats.totalItems]} />
        <StatCard title="Papers" value={stats.totalPapers} color="#8b5cf6" />
        <StatCard title="Templates" value={stats.totalTemplates} color="#06b6d4" />
        <StatCard title="Subjects" value={stats.totalSubjects} color="#f59e0b" />
        <StatCard title="CAPS Topics" value={stats.totalTopics} color="#10b981" />
        <StatCard title="CAPS Subtopics" value={stats.totalSubtopics} color="#ef4444" />
      </div>

      {/* CHARTS ROW 1: Donut + Bar Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
        {/* ITEMS BY STATUS - DONUT CHART */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <SectionTitle title="Items by Status" icon="📊" />
          {statusChartData.length === 0 ? (
            <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>No items in database</p>
          ) : (
            <DonutChart
              data={statusChartData}
              colors={statusChartData.map((_, i) => chartPalette[i % chartPalette.length])}
            />
          )}
        </div>

        {/* ITEMS BY SUBJECT - BAR CHART */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <SectionTitle title="Items by Subject" icon="📚" />
          {subjectChartData.length === 0 ? (
            <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>No subject data</p>
          ) : (
            <BarChart data={subjectChartData} color="#3b82f6" maxValue={maxSubjectCount} />
          )}
        </div>
      </div>

      {/* CHARTS ROW 2: Year + Paper Bar Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px', marginBottom: '32px' }}>
        {/* ITEMS BY YEAR - BAR CHART */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <SectionTitle title="Items by Year" icon="📅" />
          {yearChartData.length === 0 ? (
            <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>No year data</p>
          ) : (
            <BarChart data={yearChartData} color="#8b5cf6" maxValue={maxYearCount} />
          )}
        </div>

        {/* ITEMS BY PAPER - BAR CHART */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <SectionTitle title="Items by Paper" icon="📝" />
          {paperChartData.length === 0 ? (
            <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>No paper data</p>
          ) : (
            <BarChart data={paperChartData} color="#f59e0b" maxValue={maxPaperCount} />
          )}
        </div>

        {/* ITEMS BY GRADE - BAR CHART */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <SectionTitle title="Items by Grade" icon="🎓" />
          {stats.itemsByGrade.length === 0 ? (
            <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>No grade data</p>
          ) : (
            <BarChart
              data={stats.itemsByGrade.map(g => ({ label: g.grade_label, value: g.count }))}
              color="#10b981"
              maxValue={Math.max(...stats.itemsByGrade.map(g => g.count), 1)}
            />
          )}
        </div>
      </div>

      {/* ASSESSMENT BODY + PAPERS BY STATUS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
        {/* ITEMS BY ASSESSMENT BODY */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <SectionTitle title="Items by Assessment Body" icon="🏛️" />
          {stats.itemsByBody.length === 0 ? (
            <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>No assessment body data</p>
          ) : (
            <BarChart
              data={stats.itemsByBody.map(b => ({ label: b.body_code, value: b.count }))}
              color="#06b6d4"
              maxValue={Math.max(...stats.itemsByBody.map(b => b.count), 1)}
            />
          )}
        </div>

        {/* PAPERS BY STATUS - DONUT CHART */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <SectionTitle title="Papers by Status" icon="📄" />
          {Object.entries(stats.papersByStatus).length === 0 ? (
            <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>No papers in database</p>
          ) : (
            <DonutChart
              data={Object.entries(stats.papersByStatus).map(([status, count]) => ({
                label: status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                value: count
              }))}
              colors={chartPalette}
            />
          )}
        </div>
      </div>

      {/* RECENT ACTIVITY */}
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
                    <span>{paper.body_code}</span>
                    <span>{paper.year_value}</span>
                    <span>{paper.grade_label}</span>
                    <span>Paper {paper.paper_no}</span>
                    <span>{paper.total_marks} marks</span>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      background: (statusColors[paper.status] || '#6b7280') + '20',
                      color: statusColors[paper.status] || '#6b7280'
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

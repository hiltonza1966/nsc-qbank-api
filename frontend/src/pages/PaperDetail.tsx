import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';

interface Paper {
  paper_id: string;
  paper_title: string;
  subject_official_code: string;
  subject_alpha_code: string;
  paper_no: string;
  subject_name: string;
  template_name: string;
  total_marks: number;
  status: string;
  created_at: string;
  updated_at: string;
  items?: any[];
}

const PaperDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [paper, setPaper] = useState<Paper | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('items');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Lookup data for create form
  const [subjects, setSubjects] = useState<any[]>([]);
  const [papers, setPapers] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [years, setYears] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [assessmentTypes, setAssessmentTypes] = useState<any[]>([]);
  const [assessmentBodies, setAssessmentBodies] = useState<any[]>([]);

  // Create form state
  const [formData, setFormData] = useState({
    subject_official_code: '',
    subject_alpha_code: '',
    paper_no: '',
    title: '',
    template_id: '',
    year_id: '',
    grade_id: '',
    assessment_type_id: '',
    assessment_body_id: '',
    total_marks: '',
  });

  useEffect(() => {
    if (id && id !== 'new') {
      fetchPaper();
    } else {
      setLoading(false);
      fetchLookups();
    }
  }, [id]);

  async function fetchPaper() {
    setLoading(true);
    try {
      const response = await fetch(`/api/qbank/papers/${id}`, {
        headers: { 'x-user-role': localStorage.getItem('qbank_role') || 'author' },
      });
      if (!response.ok) { setPaper(null); setLoading(false); return; }
      const data = await response.json();
      if (data.success) setPaper(data.paper);
      else setPaper(null);
    } catch (err) { setPaper(null); }
    setLoading(false);
  }

  async function fetchLookups() {
    try {
      const headers = { 'x-user-role': localStorage.getItem('qbank_role') || 'author' };
      const [subjRes, paperRes, tempRes, yearRes, gradeRes, typeRes, bodyRes] = await Promise.all([
        fetch('/api/lookup/lookup_subjects', { headers }),
        fetch('/api/lookup/lookup_papers', { headers }),
        fetch('/api/qbank/templates', { headers }),
        fetch('/api/lookup/lookup_years', { headers }),
        fetch('/api/lookup/lookup_grades', { headers }),
        fetch('/api/lookup/lookup_assessment_types', { headers }),
        fetch('/api/lookup/lookup_assessment_bodies', { headers }),
      ]);

      if (subjRes.ok) { const d = await subjRes.json(); setSubjects(d.data || d.subjects || []); }
      if (paperRes.ok) { const d = await paperRes.json(); setPapers(d.data || []); }
      if (tempRes.ok) { const d = await tempRes.json(); setTemplates(d.data || []); }
      if (yearRes.ok) { const d = await yearRes.json(); setYears(d.data || []); }
      if (gradeRes.ok) { const d = await gradeRes.json(); setGrades(d.data || []); }
      if (typeRes.ok) { const d = await typeRes.json(); setAssessmentTypes(d.data || []); }
      if (bodyRes.ok) { const d = await bodyRes.json(); setAssessmentBodies(d.data || []); }
    } catch (e) { console.error('Lookup fetch error:', e); }
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const response = await fetch('/api/qbank/papers/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': localStorage.getItem('qbank_role') || 'author',
        },
        body: JSON.stringify({
          ...formData,
          total_marks: parseInt(formData.total_marks) || 0,
        }),
      });
      const data = await response.json();
      if (data.success) {
        navigate(`/papers/${data.paper_id}`);
      } else {
        setSaveError(data.error || 'Failed to create paper');
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Network error');
    }
    setSaving(false);
  }

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    marginBottom: '16px',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: '#6b7280',
    marginBottom: '4px',
    textTransform: 'uppercase',
  };

  const btnStyle: React.CSSProperties = {
    padding: '12px 24px',
    background: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  };

  const tabStyle = (tab: string): React.CSSProperties => ({
    padding: '12px 20px',
    borderBottom: activeTab === tab ? '3px solid #3b82f6' : '3px solid transparent',
    color: activeTab === tab ? '#3b82f6' : '#6b7280',
    fontWeight: 600,
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    borderBottomWidth: '3px',
    borderBottomStyle: 'solid',
    borderBottomColor: activeTab === tab ? '#3b82f6' : 'transparent',
  });

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p>Loading paper...</p>
      </div>
    );
  }

  if (!paper && id !== 'new') {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ fontSize: '18px', color: '#6b7280' }}>Paper not found</p>
        <Link to="/papers" style={{ display: 'inline-block', marginTop: '16px', padding: '10px 20px', background: '#3b82f6', color: 'white', textDecoration: 'none', borderRadius: '6px' }}>Back to Papers</Link>
      </div>
    );
  }

  // CREATE MODE
  if (id === 'new') {
    return (
      <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px' }}>
          <Link to="/papers" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}>â† Back to Papers</Link>
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px', color: '#1f2937' }}>Create New Paper</h1>

        {saveError && (
          <div style={{ background: '#fee2e2', color: '#dc2626', padding: '12px', borderRadius: '6px', marginBottom: '16px' }}>
            {saveError}
          </div>
        )}

        <div style={{ background: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Subject</label>
              <select name="subject_official_code" value={formData.subject_official_code} onChange={handleChange} style={inputStyle}>
                <option value="">Select subject...</option>
                {subjects.map(s => (
                  <option key={s.subject_official_code || s.subject_id} value={s.subject_official_code}>{s.subject_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Paper</label>
              <select name="paper_no" value={formData.paper_no} onChange={handleChange} style={inputStyle}>
                <option value="">Select paper...</option>
                {papers.map(p => (
                  <option key={p.paper_no || p.paper_id} value={p.paper_no}>{p.paper_title || `Paper ${p.paper_no}`}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Template</label>
              <select name="template_id" value={formData.template_id} onChange={handleChange} style={inputStyle}>
                <option value="">Select template...</option>
                {templates.map(t => (
                  <option key={t.template_id || t.id} value={t.template_id || t.id}>{t.template_name || t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Year</label>
              <select name="year_id" value={formData.year_id} onChange={handleChange} style={inputStyle}>
                <option value="">Select year...</option>
                {years.map(y => (
                  <option key={y.year_id || y.id} value={y.year_id || y.id}>{y.year_name || y.name || y.year}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Grade</label>
              <select name="grade_id" value={formData.grade_id} onChange={handleChange} style={inputStyle}>
                <option value="">Select grade...</option>
                {grades.map(g => (
                  <option key={g.grade_id || g.id} value={g.grade_id || g.id}>{g.grade_name || g.name || `Grade ${g.grade_number}`}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Assessment Type</label>
              <select name="assessment_type_id" value={formData.assessment_type_id} onChange={handleChange} style={inputStyle}>
                <option value="">Select type...</option>
                {assessmentTypes.map(t => (
                  <option key={t.assessment_type_id || t.id} value={t.assessment_type_id || t.id}>{t.assessment_type_name || t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Assessment Body</label>
              <select name="assessment_body_id" value={formData.assessment_body_id} onChange={handleChange} style={inputStyle}>
                <option value="">Select body...</option>
                {assessmentBodies.map(b => (
                  <option key={b.assessment_body_id || b.id} value={b.assessment_body_id || b.id}>{b.assessment_body_name || b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Total Marks</label>
              <input type="number" name="total_marks" value={formData.total_marks} onChange={handleChange} style={inputStyle} placeholder="e.g. 150" />
            </div>
          </div>

          <div style={{ marginTop: '16px' }}>
            <label style={labelStyle}>Paper Title</label>
            <input type="text" name="title" value={formData.title} onChange={handleChange} style={inputStyle} placeholder="e.g. Mathematics Paper 1 - November 2025" />
          </div>

          <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
            <button onClick={handleSave} disabled={saving} style={{ ...btnStyle, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Creating...' : 'Create Paper'}
            </button>
            <Link to="/papers" style={{ padding: '12px 24px', background: '#e5e7eb', color: '#374151', textDecoration: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600 }}>Cancel</Link>
          </div>
        </div>
      </div>
    );
  }

  // VIEW MODE (existing paper)
  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/papers" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}>â† Back to Papers</Link>
        <span style={{ fontSize: '12px', color: '#6b7280', background: '#f3f4f6', padding: '4px 12px', borderRadius: '12px' }}>{paper?.status || 'draft'}</span>
      </div>

      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px', color: '#1f2937' }}>{paper?.paper_title || 'Untitled Paper'}</h1>
      <p style={{ color: '#6b7280', marginBottom: '24px' }}>{paper?.subject_name || paper?.subject_official_code} â€¢ Paper {paper?.paper_no} â€¢ {paper?.template_name || 'No template'}</p>

      <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
          <button onClick={() => setActiveTab('items')} style={tabStyle('items')}>Items</button>
          <button onClick={() => setActiveTab('preview')} style={tabStyle('preview')}>Preview</button>
          <button onClick={() => setActiveTab('memo')} style={tabStyle('memo')}>Memo</button>
          <button onClick={() => setActiveTab('moderation')} style={tabStyle('moderation')}>Moderation</button>
        </div>
      </div>

      {/* Items Tab */}
      {activeTab === 'items' && (
        <div style={{ background: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          {paper?.items && paper.items.length > 0 ? (
            <div>
              {paper.items.map((it: any, idx: number) => (
                <div key={it.item_id || idx} style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontWeight: 600, color: '#1f2937' }}>Q{idx + 1}: {it.question_text?.substring(0, 60) || 'No text'}...</p>
                    <p style={{ fontSize: '12px', color: '#6b7280' }}>{it.marks} marks â€¢ {it.cognitive_level || 'â€”'} â€¢ {it.difficulty || 'â€”'}</p>
                  </div>
                  <Link to={`/items/${it.item_id}`} style={{ padding: '6px 12px', background: '#3b82f6', color: 'white', textDecoration: 'none', borderRadius: '4px', fontSize: '12px' }}>View</Link>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#6b7280', textAlign: 'center', padding: '40px' }}>No items in this paper yet.</p>
          )}
        </div>
      )}

      {/* Preview Tab */}
      {activeTab === 'preview' && (
        <div style={{ background: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <p style={{ color: '#6b7280', textAlign: 'center', padding: '40px' }}>Paper preview will be displayed here.</p>
        </div>
      )}

      {/* Memo Tab */}
      {activeTab === 'memo' && (
        <div style={{ background: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <p style={{ color: '#6b7280', textAlign: 'center', padding: '40px' }}>Marking guidelines will be displayed here.</p>
        </div>
      )}

      {/* Moderation Tab */}
      {activeTab === 'moderation' && (
        <div style={{ background: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <p style={{ color: '#6b7280', textAlign: 'center', padding: '40px' }}>Moderation history will be displayed here.</p>
        </div>
      )}
    </div>
  );
};

export default PaperDetail;


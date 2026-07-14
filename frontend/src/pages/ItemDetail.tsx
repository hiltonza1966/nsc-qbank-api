import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';

interface Item {
  item_id: string;
  item_code: string;
  question_number: string;
  question_text: string;
  question_text_afr: string;
  marks: number;
  marks_allocated: number;
  cognitive_level: string;
  cognitive_level_name: string;
  difficulty: string;
  difficulty_name: string;
  item_type_name: string;
  caps_topic_name: string;
  caps_subtopic_name: string;
  exposure_count: number;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  status: string;
  item_answer_json?: any;
  correct_answer?: string;
  options?: any[];
  memos?: any[];
  attachments?: any[];
  tags?: any[];
  auditLogs?: any[];
  secureMedia?: any[];
}

const ItemDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('content');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Lookup data for create form
  const [subjects, setSubjects] = useState<any[]>([]);
  const [papers, setPapers] = useState<any[]>([]);
  const [years, setYears] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [assessmentTypes, setAssessmentTypes] = useState<any[]>([]);
  const [assessmentBodies, setAssessmentBodies] = useState<any[]>([]);
  const [cognitiveLevels, setCognitiveLevels] = useState<any[]>([]);
  const [difficulties, setDifficulties] = useState<any[]>([]);
  const [itemTypes, setItemTypes] = useState<any[]>([]);
  const [languages, setLanguages] = useState<any[]>([]);
  const [markingSchemes, setMarkingSchemes] = useState<any[]>([]);
  const [capsTopics, setCapsTopics] = useState<any[]>([]);
  const [capsSubtopics, setCapsSubtopics] = useState<any[]>([]);
  const [allCapsTopics, setAllCapsTopics] = useState<any[]>([]);
  const [allCapsSubtopics, setAllCapsSubtopics] = useState<any[]>([]);

  // Create form state
  const [formData, setFormData] = useState({
    subject_official_code: '',
    paper_no: '',
    year_id: '',
    grade_id: '',
    assessment_type_id: '',
    assessment_body_id: '',
    language_id: '1',
    marking_scheme_id: '',
    item_type_id: '',
    cognitive_level_id: '',
    difficulty_id: '',
    question_number: '',
    marks: '',
    question_text: '',
    question_text_afr: '',
    caps_topic_id: '',
    caps_subtopic_id: '',
  });

  useEffect(() => {
    if (id && id !== 'new') {
      fetchItem();
    } else {
      setLoading(false);
      fetchLookups();
    }
  }, [id]);

  // When subject changes, filter CAPS topics for that subject
  useEffect(() => {
    if (formData.subject_official_code && allCapsTopics.length > 0) {
      const selectedSubject = subjects.find(s => s.subject_official_code === formData.subject_official_code);
      const codesToMatch = [formData.subject_official_code];
      if (selectedSubject?.subject_alpha_code) {
        codesToMatch.push(selectedSubject.subject_alpha_code);
      }
      const filtered = allCapsTopics.filter(
        (t) => codesToMatch.includes(t.subject_official_code)
      );
      setCapsTopics(filtered);
      // Reset topic and subtopic when subject changes
      setFormData(prev => ({ ...prev, caps_topic_id: '', caps_subtopic_id: '' }));
    } else {
      setCapsTopics([]);
    }
  }, [formData.subject_official_code, allCapsTopics, subjects]);

  // When topic changes, filter subtopics for that topic
  useEffect(() => {
    if (formData.caps_topic_id && allCapsSubtopics.length > 0) {
      const filtered = allCapsSubtopics.filter(
        (s) => String(s.topic_id) === String(formData.caps_topic_id)
      );
      setCapsSubtopics(filtered);
    } else {
      setCapsSubtopics([]);
    }
  }, [formData.caps_topic_id, allCapsSubtopics]);

  async function fetchItem() {
    setLoading(true);
    try {
      const response = await fetch(`/api/qbank/items/${id}`, {
        headers: { 'x-user-role': localStorage.getItem('qbank_role') || 'author' },
      });
      if (!response.ok) { setItem(null); setLoading(false); return; }
      const data = await response.json();
      if (data.success) setItem(data.item);
      else setItem(null);
    } catch (err) { setItem(null); }
    setLoading(false);
  }

  async function fetchLookups() {
    try {
      const headers = { 'x-user-role': localStorage.getItem('qbank_role') || 'author' };
      const endpoints = [
        { url: '/api/lookup/lookup_subjects', setter: setSubjects, field: 'data' },
        { url: '/api/lookup/lookup_papers', setter: setPapers, field: 'data' },
        { url: '/api/lookup/lookup_years', setter: setYears, field: 'data' },
        { url: '/api/lookup/lookup_grades', setter: setGrades, field: 'data' },
        { url: '/api/lookup/lookup_assessment_types', setter: setAssessmentTypes, field: 'data' },
        { url: '/api/lookup/lookup_assessment_bodies', setter: setAssessmentBodies, field: 'data' },
        { url: '/api/lookup/lookup_cognitive_levels', setter: setCognitiveLevels, field: 'data' },
        { url: '/api/lookup/lookup_difficulty_levels', setter: setDifficulties, field: 'data' },
        { url: '/api/lookup/lookup_item_types', setter: setItemTypes, field: 'data' },
        { url: '/api/lookup/lookup_languages', setter: setLanguages, field: 'data' },
        { url: '/api/lookup/lookup_marking_schemes', setter: setMarkingSchemes, field: 'data' },
        { url: '/api/lookup/lookup_caps_topics', setter: setAllCapsTopics, field: 'data' },
        { url: '/api/lookup/lookup_caps_subtopics', setter: setAllCapsSubtopics, field: 'data' },
      ];

      for (const ep of endpoints) {
        try {
          const res = await fetch(ep.url, { headers });
          if (res.ok) {
            const d = await res.json();
            const data = d[ep.field] || d.data || d.subjects || d || [];
            ep.setter(data);
          }
        } catch (e) {
          console.error(`Failed to fetch ${ep.url}:`, e);
        }
      }
    } catch (e) {
      console.error('Lookup fetch error:', e);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      // Build payload - exclude caps_topic_id (not in schema), include all required fields
      const payload: any = {
        subject_official_code: formData.subject_official_code,
        paper_no: parseInt(formData.paper_no) || 1,
        year_id: parseInt(formData.year_id) || 6,
        grade_id: parseInt(formData.grade_id) || 1,
        assessment_type_id: parseInt(formData.assessment_type_id) || 1,
        assessment_body_id: parseInt(formData.assessment_body_id) || 1,
        language_id: parseInt(formData.language_id) || 1,
        item_type_id: parseInt(formData.item_type_id) || 1,
        cognitive_level_id: parseInt(formData.cognitive_level_id) || 1,
        difficulty_id: parseInt(formData.difficulty_id) || 1,
        marking_scheme_id: formData.marking_scheme_id ? parseInt(formData.marking_scheme_id) : null,
        question_number: formData.question_number || '1.1',
        marks: parseInt(formData.marks) || 1,
        question_text: formData.question_text,
        question_text_afr: formData.question_text_afr || null,
        caps_subtopic_id: formData.caps_subtopic_id ? parseInt(formData.caps_subtopic_id) : null,
      };

      const response = await fetch('/api/qbank/items/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': localStorage.getItem('qbank_role') || 'author',
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (data.success) {
        navigate(`/items/${data.item_id}`);
      } else {
        setSaveError(data.error || 'Failed to save item');
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
        <p>Loading item...</p>
      </div>
    );
  }

  if (!item && id !== 'new') {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ fontSize: '18px', color: '#6b7280' }}>Item not found</p>
        <Link to="/items" style={{ display: 'inline-block', marginTop: '16px', padding: '10px 20px', background: '#3b82f6', color: 'white', textDecoration: 'none', borderRadius: '6px' }}>Back to Items</Link>
      </div>
    );
  }

  // CREATE MODE
  if (id === 'new') {
    return (
      <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px' }}>
          <Link to="/items" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}>&#8592; Back to Items</Link>
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px', color: '#1f2937' }}>Create New Item</h1>

        {saveError && (
          <div style={{ background: '#fee2e2', color: '#dc2626', padding: '12px', borderRadius: '6px', marginBottom: '16px' }}>
            {saveError}
          </div>
        )}

        <div style={{ background: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          {/* Row 1: Subject (first) + Paper */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Subject *</label>
              <select name="subject_official_code" value={formData.subject_official_code} onChange={handleChange} style={inputStyle}>
                <option value="">Select subject...</option>
                {subjects.map(s => (
                  <option key={s.subject_official_code || s.subject_id} value={s.subject_official_code}>{s.subject_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Paper *</label>
              <select name="paper_no" value={formData.paper_no} onChange={handleChange} style={inputStyle}>
                <option value="">Select paper...</option>
                {papers.map(p => (
                  <option key={p.paper_no || p.paper_id} value={p.paper_no}>{p.paper_name || `Paper ${p.paper_no}`}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Year + Grade */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Year</label>
              <select name="year_id" value={formData.year_id} onChange={handleChange} style={inputStyle}>
                <option value="">Select year...</option>
                {years.map(y => (
                  <option key={y.year_id || y.id} value={y.year_id || y.id}>{y.year_value || y.year_label || y.year}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Grade</label>
              <select name="grade_id" value={formData.grade_id} onChange={handleChange} style={inputStyle}>
                <option value="">Select grade...</option>
                {grades.map(g => (
                  <option key={g.grade_id || g.id} value={g.grade_id || g.id}>{g.grade_label || g.grade_name || `Grade ${g.grade_number}`}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 3: Assessment Type + Assessment Body */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Assessment Type</label>
              <select name="assessment_type_id" value={formData.assessment_type_id} onChange={handleChange} style={inputStyle}>
                <option value="">Select type...</option>
                {assessmentTypes.map(a => (
                  <option key={a.assessment_type_id || a.id} value={a.assessment_type_id || a.id}>{a.type_name || a.assessment_type_name || a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Assessment Body</label>
              <select name="assessment_body_id" value={formData.assessment_body_id} onChange={handleChange} style={inputStyle}>
                <option value="">Select body...</option>
                {assessmentBodies.map(b => (
                  <option key={b.assessment_body_id || b.id} value={b.assessment_body_id || b.id}>{b.body_name || b.assessment_body_name || b.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 4: Item Type + Question Number */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Item Type</label>
              <select name="item_type_id" value={formData.item_type_id} onChange={handleChange} style={inputStyle}>
                <option value="">Select type...</option>
                {itemTypes.map(t => (
                  <option key={t.item_type_id || t.id} value={t.item_type_id || t.id}>{t.type_name || t.item_type_name || t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Question Number</label>
              <input type="text" name="question_number" value={formData.question_number} onChange={handleChange} style={inputStyle} placeholder="e.g. 1.1, 2.3" />
            </div>
          </div>

          {/* Row 5: Cognitive Level + Difficulty */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Cognitive Level</label>
              <select name="cognitive_level_id" value={formData.cognitive_level_id} onChange={handleChange} style={inputStyle}>
                <option value="">Select level...</option>
                {cognitiveLevels.map(c => (
                  <option key={c.cognitive_level_id || c.id} value={c.cognitive_level_id || c.id}>{c.level_name || c.cognitive_level_name || c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Difficulty</label>
              <select name="difficulty_id" value={formData.difficulty_id} onChange={handleChange} style={inputStyle}>
                <option value="">Select difficulty...</option>
                {difficulties.map(d => (
                  <option key={d.difficulty_id || d.id} value={d.difficulty_id || d.id}>{d.difficulty_name || d.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 6: Language + Marking Scheme */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Language</label>
              <select name="language_id" value={formData.language_id} onChange={handleChange} style={inputStyle}>
                <option value="">Select language...</option>
                {languages.map(l => (
                  <option key={l.language_id || l.id} value={l.language_id || l.id}>{l.language_name || l.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Marking Scheme</label>
              <select name="marking_scheme_id" value={formData.marking_scheme_id} onChange={handleChange} style={inputStyle}>
                <option value="">Select scheme...</option>
                {markingSchemes.map(m => (
                  <option key={m.marking_scheme_id || m.id} value={m.marking_scheme_id || m.id}>{m.scheme_name || m.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 7: Marks */}
          <div>
            <label style={labelStyle}>Marks</label>
            <input type="number" name="marks" value={formData.marks} onChange={handleChange} style={inputStyle} placeholder="e.g. 5" />
          </div>

          {/* Row 8: CAPS Topic (filtered by subject) + CAPS Subtopic (filtered by topic) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            <div>
              <label style={labelStyle}>CAPS Topic</label>
              <select name="caps_topic_id" value={formData.caps_topic_id} onChange={handleChange} style={inputStyle}>
                <option value="">{formData.subject_official_code ? 'Select topic...' : 'Select subject first'}</option>
                {capsTopics.map(t => (
                  <option key={t.topic_id || t.caps_topic_id || t.id} value={t.topic_id || t.caps_topic_id || t.id}>{t.topic_name || t.caps_topic_name || t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>CAPS Subtopic</label>
              <select name="caps_subtopic_id" value={formData.caps_subtopic_id} onChange={handleChange} style={inputStyle}>
                <option value="">{formData.caps_topic_id ? 'Select subtopic...' : 'Select topic first'}</option>
                {capsSubtopics.map(s => (
                  <option key={s.subtopic_id || s.caps_subtopic_id || s.id} value={s.subtopic_id || s.caps_subtopic_id || s.id}>{s.subtopic_name || s.caps_subtopic_name || s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginTop: '16px' }}>
            <label style={labelStyle}>Question Text (English) *</label>
            <textarea name="question_text" value={formData.question_text} onChange={handleChange} style={{ ...inputStyle, minHeight: '120px', resize: 'vertical' }} placeholder="Enter the question text..." />
          </div>

          <div style={{ marginTop: '16px' }}>
            <label style={labelStyle}>Question Text (Afrikaans)</label>
            <textarea name="question_text_afr" value={formData.question_text_afr} onChange={handleChange} style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} placeholder="Enter Afrikaans translation (optional)..." />
          </div>

          <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
            <button onClick={handleSave} disabled={saving} style={{ ...btnStyle, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving...' : 'Save Item'}
            </button>
            <Link to="/items" style={{ padding: '12px 24px', background: '#e5e7eb', color: '#374151', textDecoration: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600 }}>Cancel</Link>
          </div>
        </div>
      </div>
    );
  }

  // VIEW MODE (existing item) - unchanged from original
  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/items" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}>&#8592; Back to Items</Link>
        <span style={{ fontSize: '12px', color: '#6b7280', background: '#f3f4f6', padding: '4px 12px', borderRadius: '12px' }}>{item?.status || 'draft'}</span>
      </div>

      <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
          <button onClick={() => setActiveTab('content')} style={tabStyle('content')}>Content</button>
          <button onClick={() => setActiveTab('metadata')} style={tabStyle('metadata')}>Metadata</button>
          <button onClick={() => setActiveTab('versions')} style={tabStyle('versions')}>Versions</button>
          <button onClick={() => setActiveTab('reviews')} style={tabStyle('reviews')}>Reviews</button>
        </div>
      </div>

      {/* Content Tab */}
      {activeTab === 'content' && (
        <div>
          {/* Question Stem */}
          <div style={{ background: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>Question</h3>
            <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '6px', fontSize: '15px', lineHeight: '1.6', color: '#1f2937' }}>
              {item?.question_text || 'No question text'}
            </div>
          </div>

          {/* MCQ Options — parsed from item_answer_json */}
          {(() => {
            // Parse item_answer_json for MCQ options
            let mcqData: any = null;
            if (item?.item_answer_json) {
              try {
                mcqData = typeof item.item_answer_json === 'string'
                  ? JSON.parse(item.item_answer_json)
                  : item.item_answer_json;
              } catch (e) {
                mcqData = null;
              }
            }
            // Also check direct options field
            const opts = mcqData?.options || item?.options;
            if (!opts || Object.keys(opts).length === 0) return null;

            const optionEntries = Object.entries(opts);
            const correctAnswer = mcqData?.correct_answer || mcqData?.answer || item?.correct_answer;

            return (
              <div style={{ background: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>
                  Options
                  {correctAnswer && (
                    <span style={{
                      marginLeft: '12px',
                      fontSize: '12px',
                      fontWeight: '500',
                      color: '#059669',
                      background: '#d1fae5',
                      padding: '4px 10px',
                      borderRadius: '12px',
                    }}>
                      Correct: {correctAnswer}
                    </span>
                  )}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {optionEntries.map(([label, text]: [string, any]) => {
                    const isCorrect = correctAnswer && String(correctAnswer).toUpperCase() === String(label).toUpperCase();
                    return (
                      <div
                        key={label}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '14px',
                          padding: '14px 18px',
                          borderRadius: '8px',
                          border: isCorrect ? '2px solid #10b981' : '1px solid #e5e7eb',
                          background: isCorrect ? '#ecfdf5' : '#fafafa',
                          transition: 'all 0.15s',
                        }}
                      >
                        <span style={{
                          width: '32px',
                          height: '32px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '50%',
                          background: isCorrect ? '#10b981' : '#e5e7eb',
                          color: isCorrect ? 'white' : '#374151',
                          fontWeight: '700',
                          fontSize: '14px',
                          flexShrink: 0,
                        }}>
                          {label}
                        </span>
                        <span style={{ fontSize: '15px', color: '#1f2937', lineHeight: '1.5' }}>
                          {typeof text === 'string' ? text : JSON.stringify(text)}
                        </span>
                        {isCorrect && (
                          <span style={{
                            marginLeft: 'auto',
                            fontSize: '12px',
                            fontWeight: '600',
                            color: '#059669',
                            background: '#d1fae5',
                            padding: '4px 10px',
                            borderRadius: '12px',
                          }}>
                            ✓ Correct
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {item?.question_text_afr && (
            <div style={{ background: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>Afrikaans</h3>
              <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '6px', fontSize: '15px', lineHeight: '1.6', color: '#1f2937' }}>
                {item?.question_text_afr}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Metadata Tab */}
      {activeTab === 'metadata' && (
        <div style={{ background: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            <div><label style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>ITEM CODE</label><p style={{ marginTop: '4px', color: '#1f2937' }}>{item?.item_code || '&#8212;'}</p></div>
            <div><label style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>QUESTION NUMBER</label><p style={{ marginTop: '4px', color: '#1f2937' }}>{item?.question_number || '&#8212;'}</p></div>
            <div><label style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>MARKS</label><p style={{ marginTop: '4px', color: '#1f2937', fontWeight: '600' }}>{item?.marks || '&#8212;'}</p></div>
            <div><label style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>ITEM TYPE</label><p style={{ marginTop: '4px', color: '#1f2937' }}>{item?.item_type_name || '&#8212;'}</p></div>
            <div><label style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>COGNITIVE LEVEL</label><p style={{ marginTop: '4px', color: '#1f2937' }}>{item?.cognitive_level_name || '&#8212;'}</p></div>
            <div><label style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>DIFFICULTY</label><p style={{ marginTop: '4px', color: '#1f2937' }}>{item?.difficulty_name || '&#8212;'}</p></div>
            <div><label style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>CAPS TOPIC</label><p style={{ marginTop: '4px', color: '#1f2937' }}>{item?.caps_topic_name || '&#8212;'}</p></div>
            <div><label style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>CAPS SUBTOPIC</label><p style={{ marginTop: '4px', color: '#1f2937' }}>{item?.caps_subtopic_name || '&#8212;'}</p></div>
            <div><label style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>EXPOSURE COUNT</label><p style={{ marginTop: '4px', color: '#1f2937' }}>{item?.exposure_count || 0}</p></div>
            <div><label style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>CREATED BY</label><p style={{ marginTop: '4px', color: '#1f2937' }}>{item?.created_by_name || '&#8212;'}</p></div>
            <div><label style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>CREATED AT</label><p style={{ marginTop: '4px', color: '#1f2937' }}>{item?.created_at ? new Date(item.created_at).toLocaleString() : '&#8212;'}</p></div>
            <div><label style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>UPDATED AT</label><p style={{ marginTop: '4px', color: '#1f2937' }}>{item?.updated_at ? new Date(item.updated_at).toLocaleString() : '&#8212;'}</p></div>
          </div>
        </div>
      )}

      {/* Versions Tab */}
      {activeTab === 'versions' && (
        <div style={{ background: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <p style={{ color: '#6b7280', textAlign: 'center', padding: '40px' }}>Version history will be displayed here.</p>
        </div>
      )}

      {/* Reviews Tab */}
      {activeTab === 'reviews' && (
        <div style={{ background: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <p style={{ color: '#6b7280', textAlign: 'center', padding: '40px' }}>Review comments will be displayed here.</p>
        </div>
      )}
    </div>
  );
};

export default ItemDetail;
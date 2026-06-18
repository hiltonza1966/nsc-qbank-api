import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:4000/api';

interface Subject {
  subject_official_code: string;
  subject_alpha_code: string;
  subject_name: string;
}

interface Topic {
  topic_id: number;
  subject_official_code: string;
  grade_number: number | null;
  strand: string | null;
  term: string | null;
  topic_code: string | null;
  topic_name: string | null;
  topic_weighting: number | null;
  time_weeks: number | null;
  paper_no: number | null;
  description: string | null;
  is_active: number;
  display_order: number | null;
  subtopic_count: number;
}

interface Subtopic {
  subtopic_id: number;
  topic_id: number;
  subtopic_code: string | null;
  subtopic_name: string | null;
  description: string | null;
  is_active: number;
  display_order: number | null;
}

const CapsReviewPage: React.FC = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [subtopics, setSubtopics] = useState<Subtopic[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [showSubtopicModal, setShowSubtopicModal] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [editingSubtopic, setEditingSubtopic] = useState<Subtopic | null>(null);

  // Form states
  const [topicForm, setTopicForm] = useState<Partial<Topic>>({});
  const [subtopicForm, setSubtopicForm] = useState<Partial<Subtopic>>({});

  useEffect(() => { fetchSubjects(); }, []);

  useEffect(() => {
    if (selectedSubject) {
      fetchTopics(selectedSubject);
    } else {
      setTopics([]);
      setSelectedTopic(null);
      setSubtopics([]);
    }
  }, [selectedSubject]);

  useEffect(() => {
    if (selectedTopic) {
      fetchSubtopics(selectedTopic.topic_id);
    } else {
      setSubtopics([]);
    }
  }, [selectedTopic]);

  async function fetchSubjects() {
    try {
      const res = await fetch(`${API_BASE}/caps/subjects`);
      const data = await res.json();
      if (data.subjects) setSubjects(data.subjects);
    } catch (e) {
      console.error('Failed to fetch subjects:', e);
    }
  }

  async function fetchTopics(subjectCode: string) {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/caps/topics/${subjectCode}`);
      const data = await res.json();
      if (data.success) setTopics(data.topics || []);
      else setTopics([]);
    } catch (e) {
      setError('Failed to fetch topics');
      setTopics([]);
    }
    setLoading(false);
  }

  async function fetchSubtopics(topicId: number) {
    try {
      const res = await fetch(`${API_BASE}/caps/subtopics/${topicId}`);
      const data = await res.json();
      if (data.success) setSubtopics(data.subtopics || []);
      else setSubtopics([]);
    } catch (e) {
      console.error('Failed to fetch subtopics:', e);
      setSubtopics([]);
    }
  }

  // Topic CRUD
  async function saveTopic() {
    const url = editingTopic
      ? `${API_BASE}/caps/topics/${editingTopic.topic_id}`
      : `${API_BASE}/caps/topics`;
    const method = editingTopic ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...topicForm, subject_official_code: selectedSubject })
      });
      const data = await res.json();
      if (data.success) {
        setShowTopicModal(false);
        setEditingTopic(null);
        setTopicForm({});
        fetchTopics(selectedSubject);
      } else {
        setError(data.error || 'Failed to save topic');
      }
    } catch (e) {
      setError('Failed to save topic');
    }
  }

  async function deleteTopic(topicId: number) {
    if (!window.confirm('Delete this topic and all its subtopics?')) return;
    try {
      const res = await fetch(`${API_BASE}/caps/topics/${topicId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        if (selectedTopic?.topic_id === topicId) setSelectedTopic(null);
        fetchTopics(selectedSubject);
      }
    } catch (e) {
      setError('Failed to delete topic');
    }
  }

  // Subtopic CRUD
  async function saveSubtopic() {
    const url = editingSubtopic
      ? `${API_BASE}/caps/subtopics/${editingSubtopic.subtopic_id}`
      : `${API_BASE}/caps/subtopics`;
    const method = editingSubtopic ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...subtopicForm, topic_id: selectedTopic?.topic_id })
      });
      const data = await res.json();
      if (data.success) {
        setShowSubtopicModal(false);
        setEditingSubtopic(null);
        setSubtopicForm({});
        if (selectedTopic) fetchSubtopics(selectedTopic.topic_id);
      } else {
        setError(data.error || 'Failed to save subtopic');
      }
    } catch (e) {
      setError('Failed to save subtopic');
    }
  }

  async function deleteSubtopic(subtopicId: number) {
    if (!window.confirm('Delete this subtopic?')) return;
    try {
      const res = await fetch(`${API_BASE}/caps/subtopics/${subtopicId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success && selectedTopic) {
        fetchSubtopics(selectedTopic.topic_id);
      }
    } catch (e) {
      setError('Failed to delete subtopic');
    }
  }

  function openTopicModal(topic?: Topic) {
    if (topic) {
      setEditingTopic(topic);
      setTopicForm({ ...topic });
    } else {
      setEditingTopic(null);
      setTopicForm({ grade_number: 10, strand: '', term: '', is_active: 1, display_order: 0 });
    }
    setShowTopicModal(true);
  }

  function openSubtopicModal(subtopic?: Subtopic) {
    if (subtopic) {
      setEditingSubtopic(subtopic);
      setSubtopicForm({ ...subtopic });
    } else {
      setEditingSubtopic(null);
      setSubtopicForm({ is_active: 1, display_order: 0 });
    }
    setShowSubtopicModal(true);
  }

  const containerStyle: React.CSSProperties = {
    padding: '24px',
    fontFamily: 'system-ui, sans-serif',
    maxWidth: '1200px',
    margin: '0 auto'
  };

  const headerStyle: React.CSSProperties = {
    fontSize: '24px',
    fontWeight: 'bold',
    marginBottom: '20px',
    color: '#1f2937'
  };

  const selectStyle: React.CSSProperties = {
    padding: '8px 12px',
    fontSize: '14px',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    marginBottom: '16px',
    minWidth: '300px'
  };

  const btnPrimary: React.CSSProperties = {
    padding: '8px 16px',
    background: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    marginRight: '8px',
    marginBottom: '8px'
  };

  const btnDanger: React.CSSProperties = {
    padding: '4px 12px',
    background: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    marginRight: '4px'
  };

  const btnSecondary: React.CSSProperties = {
    padding: '4px 12px',
    background: '#6b7280',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    marginRight: '4px'
  };

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px',
    marginTop: '12px'
  };

  const thStyle: React.CSSProperties = {
    background: '#f3f4f6',
    padding: '10px',
    textAlign: 'left',
    borderBottom: '2px solid #e5e7eb',
    fontWeight: '600'
  };

  const tdStyle: React.CSSProperties = {
    padding: '10px',
    borderBottom: '1px solid #e5e7eb'
  };

  const rowHoverStyle: React.CSSProperties = {
    cursor: 'pointer'
  };

  const selectedRowStyle: React.CSSProperties = {
    background: '#dbeafe'
  };

  const modalOverlay: React.CSSProperties = {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  };

  const modalContent: React.CSSProperties = {
    background: 'white',
    padding: '24px',
    borderRadius: '8px',
    width: '500px',
    maxHeight: '80vh',
    overflow: 'auto'
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px',
    marginBottom: '12px',
    borderRadius: '4px',
    border: '1px solid #d1d5db',
    fontSize: '14px',
    boxSizing: 'border-box'
  };

  return (
    <div style={containerStyle}>
      <h1 style={headerStyle}>CAPS Review & Management</h1>

      {error && (
        <div style={{ background: '#fee2e2', border: '1px solid #ef4444', padding: '12px', borderRadius: '6px', marginBottom: '16px', color: '#991b1b' }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: '12px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#991b1b', fontWeight: 'bold' }}>×</button>
        </div>
      )}

      {/* Subject Selector */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '14px' }}>Select Subject:</label>
        <select
          style={selectStyle}
          value={selectedSubject}
          onChange={(e) => setSelectedSubject(e.target.value)}
        >
          <option value="">-- Choose a subject --</option>
          {subjects.map((s) => (
            <option key={s.subject_official_code} value={s.subject_official_code}>
              {s.subject_name} ({s.subject_alpha_code})
            </option>
          ))}
        </select>
      </div>

      {loading && <div style={{ color: '#6b7280', marginBottom: '16px' }}>Loading...</div>}

      {/* Topics Section */}
      {selectedSubject && (
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#374151' }}>
              Topics ({topics.length})
            </h2>
            <button style={btnPrimary} onClick={() => openTopicModal()}>
              + Add Topic
            </button>
          </div>

          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Code</th>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Grade</th>
                <th style={thStyle}>Term</th>
                <th style={thStyle}>Strand</th>
                <th style={thStyle}>Subtopics</th>
                <th style={thStyle}>Active</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {topics.map((topic) => (
                <tr
                  key={topic.topic_id}
                  style={{
                    ...rowHoverStyle,
                    ...(selectedTopic?.topic_id === topic.topic_id ? selectedRowStyle : {})
                  }}
                  onClick={() => setSelectedTopic(topic)}
                >
                  <td style={tdStyle}>{topic.topic_code}</td>
                  <td style={tdStyle}>{topic.topic_name}</td>
                  <td style={tdStyle}>{topic.grade_number}</td>
                  <td style={tdStyle}>{topic.term}</td>
                  <td style={tdStyle}>{topic.strand}</td>
                  <td style={tdStyle}>{topic.subtopic_count}</td>
                  <td style={tdStyle}>{topic.is_active ? 'Yes' : 'No'}</td>
                  <td style={tdStyle}>
                    <button style={btnSecondary} onClick={(e) => { e.stopPropagation(); openTopicModal(topic); }}>Edit</button>
                    <button style={btnDanger} onClick={(e) => { e.stopPropagation(); deleteTopic(topic.topic_id); }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Subtopics Section */}
      {selectedTopic && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#374151' }}>
              Subtopics for: {selectedTopic.topic_name} ({subtopics.length})
            </h2>
            <button style={btnPrimary} onClick={() => openSubtopicModal()}>
              + Add Subtopic
            </button>
          </div>

          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Code</th>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Description</th>
                <th style={thStyle}>Active</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {subtopics.map((sub) => (
                <tr key={sub.subtopic_id}>
                  <td style={tdStyle}>{sub.subtopic_code}</td>
                  <td style={tdStyle}>{sub.subtopic_name}</td>
                  <td style={tdStyle}>{sub.description}</td>
                  <td style={tdStyle}>{sub.is_active ? 'Yes' : 'No'}</td>
                  <td style={tdStyle}>
                    <button style={btnSecondary} onClick={() => openSubtopicModal(sub)}>Edit</button>
                    <button style={btnDanger} onClick={() => deleteSubtopic(sub.subtopic_id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Topic Modal */}
      {showTopicModal && (
        <div style={modalOverlay} onClick={() => setShowTopicModal(false)}>
          <div style={modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '16px' }}>{editingTopic ? 'Edit Topic' : 'Create Topic'}</h3>
            <input style={inputStyle} placeholder="Topic Code" value={topicForm.topic_code || ''} onChange={(e) => setTopicForm({ ...topicForm, topic_code: e.target.value })} />
            <input style={inputStyle} placeholder="Topic Name" value={topicForm.topic_name || ''} onChange={(e) => setTopicForm({ ...topicForm, topic_name: e.target.value })} />
            <input style={inputStyle} type="number" placeholder="Grade Number" value={topicForm.grade_number || ''} onChange={(e) => setTopicForm({ ...topicForm, grade_number: parseInt(e.target.value) || null })} />
            <input style={inputStyle} placeholder="Term" value={topicForm.term || ''} onChange={(e) => setTopicForm({ ...topicForm, term: e.target.value })} />
            <input style={inputStyle} placeholder="Strand" value={topicForm.strand || ''} onChange={(e) => setTopicForm({ ...topicForm, strand: e.target.value })} />
            <input style={inputStyle} placeholder="Description" value={topicForm.description || ''} onChange={(e) => setTopicForm({ ...topicForm, description: e.target.value })} />
            <input style={inputStyle} type="number" placeholder="Display Order" value={topicForm.display_order || ''} onChange={(e) => setTopicForm({ ...topicForm, display_order: parseInt(e.target.value) || null })} />
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '14px' }}>
              <input type="checkbox" checked={(topicForm.is_active ?? 1) === 1} onChange={(e) => setTopicForm({ ...topicForm, is_active: e.target.checked ? 1 : 0 })} />
              Active
            </label>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button style={{ ...btnPrimary, background: '#6b7280' }} onClick={() => setShowTopicModal(false)}>Cancel</button>
              <button style={btnPrimary} onClick={saveTopic}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Subtopic Modal */}
      {showSubtopicModal && (
        <div style={modalOverlay} onClick={() => setShowSubtopicModal(false)}>
          <div style={modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '16px' }}>{editingSubtopic ? 'Edit Subtopic' : 'Create Subtopic'}</h3>
            <input style={inputStyle} placeholder="Subtopic Code" value={subtopicForm.subtopic_code || ''} onChange={(e) => setSubtopicForm({ ...subtopicForm, subtopic_code: e.target.value })} />
            <input style={inputStyle} placeholder="Subtopic Name" value={subtopicForm.subtopic_name || ''} onChange={(e) => setSubtopicForm({ ...subtopicForm, subtopic_name: e.target.value })} />
            <textarea style={{ ...inputStyle, minHeight: '80px' }} placeholder="Description" value={subtopicForm.description || ''} onChange={(e) => setSubtopicForm({ ...subtopicForm, description: e.target.value })} />
            <input style={inputStyle} type="number" placeholder="Display Order" value={subtopicForm.display_order || ''} onChange={(e) => setSubtopicForm({ ...subtopicForm, display_order: parseInt(e.target.value) || null })} />
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '14px' }}>
              <input type="checkbox" checked={(subtopicForm.is_active ?? 1) === 1} onChange={(e) => setSubtopicForm({ ...subtopicForm, is_active: e.target.checked ? 1 : 0 })} />
              Active
            </label>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button style={{ ...btnPrimary, background: '#6b7280' }} onClick={() => setShowSubtopicModal(false)}>Cancel</button>
              <button style={btnPrimary} onClick={saveSubtopic}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CapsReviewPage;

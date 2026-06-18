import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const API_BASE = 'http://localhost:4000/api';

const CapsLinkerPage: React.FC = () => {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [atpData, setAtpData] = useState<any[]>([]);
  const [poaData, setPoaData] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'atp' | 'poa'>('atp');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<any>({});

  // Fetch subjects on mount
  useEffect(() => {
    fetchSubjects();
  }, []);

  // Fetch ATP/POA when subject changes
  useEffect(() => {
    if (selectedSubject) {
      fetchAtp(selectedSubject);
      fetchPoa(selectedSubject);
    } else {
      setAtpData([]);
      setPoaData([]);
    }
  }, [selectedSubject]);

  async function fetchSubjects() {
    try {
      const res = await fetch(`${API_BASE}/caps/subjects`);
      const data = await res.json();
      if (data.success) setSubjects(data.data);
    } catch (e) {
      console.error('Failed to fetch subjects:', e);
    }
  }

  async function fetchAtp(subjectCode: string) {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/caps/atp?subject_official_code=${subjectCode}`);
      const data = await res.json();
      if (data.success) setAtpData(data.data);
    } catch (e) {
      setError('Failed to fetch ATP data');
    }
    setLoading(false);
  }

  async function fetchPoa(subjectCode: string) {
    try {
      const res = await fetch(`${API_BASE}/caps/poa?subject_official_code=${subjectCode}`);
      const data = await res.json();
      if (data.success) setPoaData(data.data);
    } catch (e) {
      console.error('Failed to fetch POA data:', e);
    }
  }

  async function handleSaveEdit(type: 'atp' | 'poa') {
    if (!editingId) return;
    try {
      const url = type === 'atp' 
        ? `${API_BASE}/caps/atp/${editingId}` 
        : `${API_BASE}/caps/poa/${editingId}`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (data.success) {
        if (type === 'atp') fetchAtp(selectedSubject);
        else fetchPoa(selectedSubject);
        setEditingId(null);
        setEditForm({});
      } else {
        setError(data.error || 'Failed to save');
      }
    } catch (e) {
      setError('Network error during save');
    }
  }

  async function handleDelete(type: 'atp' | 'poa', id: number) {
    if (!confirm('Are you sure you want to delete this record?')) return;
    try {
      const url = type === 'atp' 
        ? `${API_BASE}/caps/atp/${id}` 
        : `${API_BASE}/caps/poa/${id}`;
      const res = await fetch(url, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        if (type === 'atp') fetchAtp(selectedSubject);
        else fetchPoa(selectedSubject);
      } else {
        setError(data.error || 'Failed to delete');
      }
    } catch (e) {
      setError('Network error during delete');
    }
  }

  async function handleCreate(type: 'atp' | 'poa') {
    try {
      const url = type === 'atp' 
        ? `${API_BASE}/caps/atp` 
        : `${API_BASE}/caps/poa`;
      const payload = {
        ...createForm,
        subject_official_code: selectedSubject,
        subject_name: subjects.find(s => s.subject_official_code === selectedSubject)?.subject_name || '',
      };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        if (type === 'atp') fetchAtp(selectedSubject);
        else fetchPoa(selectedSubject);
        setShowCreateModal(false);
        setCreateForm({});
      } else {
        setError(data.error || 'Failed to create');
      }
    } catch (e) {
      setError('Network error during create');
    }
  }

  const startEdit = (record: any, type: 'atp' | 'poa') => {
    setEditingId(type === 'atp' ? record.content_id : record.poa_id);
    setEditForm({ ...record });
  };

  const styles: Record<string, React.CSSProperties> = {
    container: { padding: '24px', maxWidth: '1400px', margin: '0 auto' },
    header: { marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    title: { fontSize: '24px', fontWeight: 'bold', color: '#1e293b' },
    subjectSelect: { padding: '10px 16px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px', minWidth: '300px' },
    tabs: { display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '20px' },
    tab: { padding: '12px 24px', cursor: 'pointer', borderBottom: '2px solid transparent', fontWeight: '500' },
    tabActive: { borderBottomColor: '#3b82f6', color: '#3b82f6' },
    table: { width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
    th: { textAlign: 'left', padding: '12px 16px', background: '#f8fafc', borderBottom: '2px solid #e2e8f0', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' },
    td: { padding: '12px 16px', borderBottom: '1px solid #e2e8f0', fontSize: '14px' },
    btn: { padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '12px', marginRight: '8px' },
    btnPrimary: { background: '#3b82f6', color: 'white' },
    btnDanger: { background: '#ef4444', color: 'white' },
    btnSecondary: { background: '#e2e8f0', color: '#374151' },
    btnSuccess: { background: '#22c55e', color: 'white' },
    modal: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    modalContent: { background: 'white', padding: '24px', borderRadius: '8px', width: '600px', maxHeight: '80vh', overflow: 'auto' },
    formGroup: { marginBottom: '16px' },
    label: { display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px', textTransform: 'uppercase' },
    input: { width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' },
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>CAPS Linker</h1>
        <div>
          <select 
            style={styles.subjectSelect} 
            value={selectedSubject} 
            onChange={(e) => setSelectedSubject(e.target.value)}
          >
            <option value="">Select subject...</option>
            {subjects.map(s => (
              <option key={s.subject_official_code} value={s.subject_official_code}>
                {s.subject_name} ({s.subject_official_code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#dc2626', padding: '12px', borderRadius: '6px', marginBottom: '16px' }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: '12px', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {selectedSubject && (
        <>
          <div style={styles.tabs}>
            <div 
              style={{ ...styles.tab, ...(activeTab === 'atp' ? styles.tabActive : {}) }} 
              onClick={() => setActiveTab('atp')}
            >
              Annual Teaching Plan ({atpData.length})
            </div>
            <div 
              style={{ ...styles.tab, ...(activeTab === 'poa' ? styles.tabActive : {}) }} 
              onClick={() => setActiveTab('poa')}
            >
              Programme of Assessment ({poaData.length})
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <button 
              onClick={() => { setShowCreateModal(true); setCreateForm({}); }}
              style={{ ...styles.btn, ...styles.btnPrimary }}
            >
              + Add {activeTab === 'atp' ? 'ATP' : 'POA'} Record
            </button>
          </div>

          {loading ? (
            <p>Loading...</p>
          ) : activeTab === 'atp' ? (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Grade</th>
                  <th style={styles.th}>Term</th>
                  <th style={styles.th}>Week</th>
                  <th style={styles.th}>Paper</th>
                  <th style={styles.th}>Topic</th>
                  <th style={styles.th}>Subtopic</th>
                  <th style={styles.th}>CAPS Ref</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {atpData.map(record => (
                  <tr key={record.content_id}>
                    {editingId === record.content_id ? (
                      <>
                        <td style={styles.td}><input style={styles.input} value={editForm.grade || ''} onChange={e => setEditForm({...editForm, grade: e.target.value})} /></td>
                        <td style={styles.td}><input style={styles.input} value={editForm.term || ''} onChange={e => setEditForm({...editForm, term: e.target.value})} /></td>
                        <td style={styles.td}><input style={styles.input} value={editForm.week_range || ''} onChange={e => setEditForm({...editForm, week_range: e.target.value})} /></td>
                        <td style={styles.td}><input style={styles.input} value={editForm.paper_no || ''} onChange={e => setEditForm({...editForm, paper_no: e.target.value})} /></td>
                        <td style={styles.td}><input style={styles.input} value={editForm.topic || ''} onChange={e => setEditForm({...editForm, topic: e.target.value})} /></td>
                        <td style={styles.td}><input style={styles.input} value={editForm.subtopic || ''} onChange={e => setEditForm({...editForm, subtopic: e.target.value})} /></td>
                        <td style={styles.td}><input style={styles.input} value={editForm.caps_ref || ''} onChange={e => setEditForm({...editForm, caps_ref: e.target.value})} /></td>
                        <td style={styles.td}>
                          <button onClick={() => handleSaveEdit('atp')} style={{ ...styles.btn, ...styles.btnSuccess }}>Save</button>
                          <button onClick={() => { setEditingId(null); setEditForm({}); }} style={{ ...styles.btn, ...styles.btnSecondary }}>Cancel</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={styles.td}>{record.grade}</td>
                        <td style={styles.td}>{record.term}</td>
                        <td style={styles.td}>{record.week_range}</td>
                        <td style={styles.td}>{record.paper_no}</td>
                        <td style={styles.td}>{record.topic}</td>
                        <td style={styles.td}>{record.subtopic}</td>
                        <td style={styles.td}>{record.caps_ref}</td>
                        <td style={styles.td}>
                          <button onClick={() => startEdit(record, 'atp')} style={{ ...styles.btn, ...styles.btnSecondary }}>Edit</button>
                          <button onClick={() => handleDelete('atp', record.content_id)} style={{ ...styles.btn, ...styles.btnDanger }}>Delete</button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Grade</th>
                  <th style={styles.th}>Term</th>
                  <th style={styles.th}>Week</th>
                  <th style={styles.th}>Paper</th>
                  <th style={styles.th}>Topic</th>
                  <th style={styles.th}>Subtopic</th>
                  <th style={styles.th}>Programme</th>
                  <th style={styles.th}>Weight %</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {poaData.map(record => (
                  <tr key={record.poa_id}>
                    {editingId === record.poa_id ? (
                      <>
                        <td style={styles.td}><input style={styles.input} value={editForm.grade || ''} onChange={e => setEditForm({...editForm, grade: e.target.value})} /></td>
                        <td style={styles.td}><input style={styles.input} value={editForm.term || ''} onChange={e => setEditForm({...editForm, term: e.target.value})} /></td>
                        <td style={styles.td}><input style={styles.input} value={editForm.week_range || ''} onChange={e => setEditForm({...editForm, week_range: e.target.value})} /></td>
                        <td style={styles.td}><input style={styles.input} value={editForm.paper_no || ''} onChange={e => setEditForm({...editForm, paper_no: e.target.value})} /></td>
                        <td style={styles.td}><input style={styles.input} value={editForm.topic || ''} onChange={e => setEditForm({...editForm, topic: e.target.value})} /></td>
                        <td style={styles.td}><input style={styles.input} value={editForm.subtopic || ''} onChange={e => setEditForm({...editForm, subtopic: e.target.value})} /></td>
                        <td style={styles.td}><input style={styles.input} value={editForm.programme_of_assessment || ''} onChange={e => setEditForm({...editForm, programme_of_assessment: e.target.value})} /></td>
                        <td style={styles.td}><input style={styles.input} value={editForm.weight_sba_pct || ''} onChange={e => setEditForm({...editForm, weight_sba_pct: e.target.value})} /></td>
                        <td style={styles.td}>
                          <button onClick={() => handleSaveEdit('poa')} style={{ ...styles.btn, ...styles.btnSuccess }}>Save</button>
                          <button onClick={() => { setEditingId(null); setEditForm({}); }} style={{ ...styles.btn, ...styles.btnSecondary }}>Cancel</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={styles.td}>{record.grade}</td>
                        <td style={styles.td}>{record.term}</td>
                        <td style={styles.td}>{record.week_range}</td>
                        <td style={styles.td}>{record.paper_no}</td>
                        <td style={styles.td}>{record.topic}</td>
                        <td style={styles.td}>{record.subtopic}</td>
                        <td style={styles.td}>{record.programme_of_assessment}</td>
                        <td style={styles.td}>{record.weight_sba_pct}</td>
                        <td style={styles.td}>
                          <button onClick={() => startEdit(record, 'poa')} style={{ ...styles.btn, ...styles.btnSecondary }}>Edit</button>
                          <button onClick={() => handleDelete('poa', record.poa_id)} style={{ ...styles.btn, ...styles.btnDanger }}>Delete</button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <h2 style={{ marginBottom: '20px' }}>Add {activeTab === 'atp' ? 'ATP' : 'POA'} Record</h2>
            <div style={styles.formGroup}>
              <label style={styles.label}>Grade</label>
              <input style={styles.input} value={createForm.grade || ''} onChange={e => setCreateForm({...createForm, grade: e.target.value})} placeholder="e.g. 12" />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Term</label>
              <input style={styles.input} value={createForm.term || ''} onChange={e => setCreateForm({...createForm, term: e.target.value})} placeholder="e.g. 1, 2, 3, 4" />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Week Range</label>
              <input style={styles.input} value={createForm.week_range || ''} onChange={e => setCreateForm({...createForm, week_range: e.target.value})} placeholder="e.g. 1-4" />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Paper No</label>
              <input style={styles.input} value={createForm.paper_no || ''} onChange={e => setCreateForm({...createForm, paper_no: e.target.value})} placeholder="e.g. 1, 2" />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Topic</label>
              <input style={styles.input} value={createForm.topic || ''} onChange={e => setCreateForm({...createForm, topic: e.target.value})} placeholder="Topic name" />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Subtopic</label>
              <input style={styles.input} value={createForm.subtopic || ''} onChange={e => setCreateForm({...createForm, subtopic: e.target.value})} placeholder="Subtopic name" />
            </div>
            {activeTab === 'poa' && (
              <>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Programme of Assessment</label>
                  <input style={styles.input} value={createForm.programme_of_assessment || ''} onChange={e => setCreateForm({...createForm, programme_of_assessment: e.target.value})} placeholder="e.g. Test 1" />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Weight SBA %</label>
                  <input style={styles.input} value={createForm.weight_sba_pct || ''} onChange={e => setCreateForm({...createForm, weight_sba_pct: e.target.value})} placeholder="e.g. 25.00" />
                </div>
              </>
            )}
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button onClick={() => handleCreate(activeTab)} style={{ ...styles.btn, ...styles.btnPrimary }}>Create</button>
              <button onClick={() => setShowCreateModal(false)} style={{ ...styles.btn, ...styles.btnSecondary }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CapsLinkerPage;

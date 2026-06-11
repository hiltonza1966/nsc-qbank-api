import React, { useState, useEffect } from "react";

const API_BASE = "http://localhost:4000";

interface Assessment {
  programme_id: number;
  assessment_type: string;
  assessment_name: string;
  term: string;
  weighting_percent: string;
  total_marks: number;
  duration_hours: string | null;
  paper_number: number | null;
  description: string | null;
  is_examination: number;
  is_formal: number;
  is_practical: number;
  is_compulsory: number;
  covers_topics: string | null;
  cognitive_level_distribution: string | null;
  source_document: string | null;
  extracted_at: string | null;
  created_at: string;
}

interface GradeData {
  grade_value: number;
  sba_weighting: number;
  exam_weighting: number | null;
  external_weighting: number | null;
  trial_weighting: number | null;
  assessments: Assessment[];
}

interface ProgrammeData {
  subject_name: string;
  subject_official_code: string;
  grades: GradeData[];
}

interface SubjectOption {
  subject_official_code: string;
  subject_name: string;
}

const termOrder: Record<string, number> = {
  "1": 1, "T1": 1, "2": 2, "T2": 2, "3": 3, "T3": 3, "4": 4, "T4": 4,
};

const CapsReviewDashboard: React.FC = () => {
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [subjectCode, setSubjectCode] = useState<string>("");
  const [data, setData] = useState<ProgrammeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeGrade, setActiveGrade] = useState<number>(10);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Assessment>>({});
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<Partial<Assessment>>({
    assessment_type: "test",
    assessment_name: "",
    term: "1",
    weighting_percent: "0",
    total_marks: 50,
    is_formal: 1,
    is_examination: 0,
    is_practical: 0,
    is_compulsory: 1,
  });

  useEffect(() => {
    fetch(`${API_BASE}/api/caps/subjects`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        const list = d.subjects || d;
        if (Array.isArray(list)) {
          setSubjects(list.map((s: any) => ({
            subject_official_code: s.subject_official_code,
            subject_name: s.subject_name,
          })));
        } else {
          throw new Error("Invalid subjects response format");
        }
      })
      .catch((err) => setError(`Failed to load subjects list: ${err.message}`));
  }, []);

  useEffect(() => {
    if (!subjectCode) return;
    setLoading(true);
    setError(null);
    fetch(`${API_BASE}/api/caps/assessment-programme/${subjectCode}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: ProgrammeData) => {
        setData(d);
        if (d.grades.length > 0) setActiveGrade(d.grades[0].grade_value);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [subjectCode]);

  const currentGrade = data?.grades.find((g) => g.grade_value === activeGrade);

  const sortedAssessments = React.useMemo(() => {
    if (!currentGrade) return [];
    return [...currentGrade.assessments].sort((a, b) => {
      const ta = termOrder[a.term] || 99;
      const tb = termOrder[b.term] || 99;
      if (ta !== tb) return ta - tb;
      return a.assessment_name.localeCompare(b.assessment_name);
    });
  }, [currentGrade]);

  const totalWeighting = sortedAssessments.reduce(
    (sum, a) => sum + (parseFloat(a.weighting_percent) || 0),
    0
  );

  const handleSubjectChange = (code: string) => {
    setSubjectCode(code);
  };

  const startEdit = (a: Assessment) => {
    setEditingId(a.programme_id);
    setEditForm({ ...a });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/caps/assessment/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error("Save failed");
      setEditingId(null);
      const refreshed = await fetch(`${API_BASE}/api/caps/assessment-programme/${subjectCode}`).then((r) => r.json());
      setData(refreshed);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Soft-delete this assessment? It will be marked inactive.")) return;
    try {
      const res = await fetch(`${API_BASE}/api/caps/assessment/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      const refreshed = await fetch(`${API_BASE}/api/caps/assessment-programme/${subjectCode}`).then((r) => r.json());
      setData(refreshed);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAdd = async () => {
    if (!subjectCode || !currentGrade) return;
    setSaving(true);
    try {
      const gradeIdMap: Record<number, number> = { 10: 1, 11: 2, 12: 3 };
      const gradeId = gradeIdMap[currentGrade.grade_value];
      const res = await fetch(`${API_BASE}/api/caps/assessment/${subjectCode}/${gradeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });
      if (!res.ok) throw new Error("Add failed");
      setShowAdd(false);
      setAddForm({
        assessment_type: "test",
        assessment_name: "",
        term: "1",
        weighting_percent: "0",
        total_marks: 50,
        is_formal: 1,
        is_examination: 0,
        is_practical: 0,
        is_compulsory: 1,
      });
      const refreshed = await fetch(`${API_BASE}/api/caps/assessment-programme/${subjectCode}`).then((r) => r.json());
      setData(refreshed);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const weightingColor = (total: number) => {
    if (total === 100) return "#16a34a";
    if (total > 100) return "#dc2626";
    return "#ca8a04";
  };

  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ marginBottom: "8px" }}>CAPS Assessment Programme Review</h1>
      <p style={{ color: "#666", marginBottom: "24px" }}>
        Review, edit, and manage assessment programmes extracted from CAPS documents.
      </p>

      {error && (
        <div style={{ background: "#fee2e2", color: "#991b1b", padding: "12px 16px", borderRadius: "6px", marginBottom: "16px" }}>
          <strong>Error:</strong> {error}
          <button onClick={() => setError(null)} style={{ marginLeft: "12px", cursor: "pointer" }}>Dismiss</button>
        </div>
      )}

      <div style={{ marginBottom: "24px", display: "flex", alignItems: "center", gap: "12px" }}>
        <label style={{ fontWeight: 600 }}>Subject:</label>
        <select
          value={subjectCode}
          onChange={(e) => handleSubjectChange(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #ccc", minWidth: "280px", fontSize: "14px" }}
        >
          <option value="">-- Select a subject --</option>
          {subjects.map((s) => (
            <option key={s.subject_official_code} value={s.subject_official_code}>
              {s.subject_name} ({s.subject_official_code})
            </option>
          ))}
        </select>
        {data && (
          <span style={{ color: "#666", fontSize: "14px" }}>
            Loaded: <strong>{data.subject_name}</strong>
          </span>
        )}
      </div>

      {loading && <div style={{ color: "#666" }}>Loading assessment programme...</div>}

      {!loading && data && (
        <>
          <div style={{ display: "flex", gap: "8px", marginBottom: "20px", borderBottom: "2px solid #e5e7eb", paddingBottom: "8px" }}>
            {data.grades.map((g) => (
              <button
                key={g.grade_value}
                onClick={() => setActiveGrade(g.grade_value)}
                style={{
                  padding: "8px 20px",
                  borderRadius: "6px 6px 0 0",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 600,
                  background: activeGrade === g.grade_value ? "#2563eb" : "#f3f4f6",
                  color: activeGrade === g.grade_value ? "#fff" : "#374151",
                }}
              >
                Grade {g.grade_value}
              </button>
            ))}
          </div>

          {currentGrade && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", marginBottom: "20px" }}>
                <div style={{ background: "#eff6ff", padding: "12px", borderRadius: "8px", textAlign: "center" }}>
                  <div style={{ fontSize: "12px", color: "#666", textTransform: "uppercase" }}>SBA Weighting</div>
                  <div style={{ fontSize: "20px", fontWeight: 700, color: "#1e40af" }}>{currentGrade.sba_weighting}%</div>
                </div>
                {currentGrade.exam_weighting !== null && (
                  <div style={{ background: "#fef3c7", padding: "12px", borderRadius: "8px", textAlign: "center" }}>
                    <div style={{ fontSize: "12px", color: "#666", textTransform: "uppercase" }}>Exam Weighting</div>
                    <div style={{ fontSize: "20px", fontWeight: 700, color: "#92400e" }}>{currentGrade.exam_weighting}%</div>
                  </div>
                )}
                {currentGrade.external_weighting !== null && (
                  <div style={{ background: "#fce7f3", padding: "12px", borderRadius: "8px", textAlign: "center" }}>
                    <div style={{ fontSize: "12px", color: "#666", textTransform: "uppercase" }}>External Weighting</div>
                    <div style={{ fontSize: "20px", fontWeight: 700, color: "#9d174d" }}>{currentGrade.external_weighting}%</div>
                  </div>
                )}
                {currentGrade.trial_weighting !== null && (
                  <div style={{ background: "#d1fae5", padding: "12px", borderRadius: "8px", textAlign: "center" }}>
                    <div style={{ fontSize: "12px", color: "#666", textTransform: "uppercase" }}>Trial Weighting</div>
                    <div style={{ fontSize: "20px", fontWeight: 700, color: "#065f46" }}>{currentGrade.trial_weighting}%</div>
                  </div>
                )}
                <div style={{ background: "#f3f4f6", padding: "12px", borderRadius: "8px", textAlign: "center", border: `2px solid ${weightingColor(totalWeighting)}` }}>
                  <div style={{ fontSize: "12px", color: "#666", textTransform: "uppercase" }}>Total Assigned</div>
                  <div style={{ fontSize: "20px", fontWeight: 700, color: weightingColor(totalWeighting) }}>{totalWeighting.toFixed(1)}%</div>
                </div>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <button
                  onClick={() => setShowAdd(!showAdd)}
                  style={{
                    padding: "8px 16px",
                    background: "#16a34a",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  {showAdd ? "Cancel" : "+ Add Assessment"}
                </button>
              </div>

              {showAdd && (
                <div style={{ background: "#f0fdf4", padding: "16px", borderRadius: "8px", marginBottom: "20px", border: "1px solid #bbf7d0" }}>
                  <h3 style={{ marginTop: 0, marginBottom: "12px" }}>New Assessment - Grade {activeGrade}</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
                    <div>
                      <label style={{ fontSize: "12px", fontWeight: 600 }}>Name</label>
                      <input value={addForm.assessment_name || ""} onChange={(e) => setAddForm({ ...addForm, assessment_name: e.target.value })} style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }} />
                    </div>
                    <div>
                      <label style={{ fontSize: "12px", fontWeight: 600 }}>Type</label>
                      <select value={addForm.assessment_type || "test"} onChange={(e) => setAddForm({ ...addForm, assessment_type: e.target.value })} style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}>
                        <option value="test">Test</option>
                        <option value="examination">Examination</option>
                        <option value="practical">Practical</option>
                        <option value="project">Project</option>
                        <option value="midyear_examination">Midyear Examination</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: "12px", fontWeight: 600 }}>Term</label>
                      <select value={addForm.term || "1"} onChange={(e) => setAddForm({ ...addForm, term: e.target.value })} style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}>
                        <option value="1">Term 1</option>
                        <option value="2">Term 2</option>
                        <option value="3">Term 3</option>
                        <option value="4">Term 4</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: "12px", fontWeight: 600 }}>Weighting %</label>
                      <input type="number" value={addForm.weighting_percent || "0"} onChange={(e) => setAddForm({ ...addForm, weighting_percent: e.target.value })} style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }} />
                    </div>
                    <div>
                      <label style={{ fontSize: "12px", fontWeight: 600 }}>Total Marks</label>
                      <input type="number" value={addForm.total_marks || 50} onChange={(e) => setAddForm({ ...addForm, total_marks: parseInt(e.target.value) || 0 })} style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }} />
                    </div>
                    <div>
                      <label style={{ fontSize: "12px", fontWeight: 600 }}>Duration (hours)</label>
                      <input value={addForm.duration_hours || ""} onChange={(e) => setAddForm({ ...addForm, duration_hours: e.target.value || null })} style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }} />
                    </div>
                    <div>
                      <label style={{ fontSize: "12px", fontWeight: 600 }}>Paper #</label>
                      <input type="number" value={addForm.paper_number || ""} onChange={(e) => setAddForm({ ...addForm, paper_number: e.target.value ? parseInt(e.target.value) : null })} style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }} />
                    </div>
                    <div style={{ display: "flex", gap: "12px", alignItems: "end" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px" }}>
                        <input type="checkbox" checked={!!addForm.is_examination} onChange={(e) => setAddForm({ ...addForm, is_examination: e.target.checked ? 1 : 0 })} /> Exam
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px" }}>
                        <input type="checkbox" checked={!!addForm.is_practical} onChange={(e) => setAddForm({ ...addForm, is_practical: e.target.checked ? 1 : 0 })} /> Practical
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px" }}>
                        <input type="checkbox" checked={!!addForm.is_formal} onChange={(e) => setAddForm({ ...addForm, is_formal: e.target.checked ? 1 : 0 })} /> Formal
                      </label>
                    </div>
                  </div>
                  <div style={{ marginTop: "12px" }}>
                    <label style={{ fontSize: "12px", fontWeight: 600 }}>Description</label>
                    <textarea value={addForm.description || ""} onChange={(e) => setAddForm({ ...addForm, description: e.target.value || null })} rows={2} style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }} />
                  </div>
                  <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
                    <button onClick={handleAdd} disabled={saving} style={{ padding: "8px 16px", background: "#16a34a", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
                      {saving ? "Saving..." : "Save Assessment"}
                    </button>
                    <button onClick={() => setShowAdd(false)} style={{ padding: "8px 16px", background: "#e5e7eb", border: "none", borderRadius: "6px", cursor: "pointer" }}>Cancel</button>
                  </div>
                </div>
              )}

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                      <th style={{ textAlign: "left", padding: "10px" }}>Term</th>
                      <th style={{ textAlign: "left", padding: "10px" }}>Type</th>
                      <th style={{ textAlign: "left", padding: "10px" }}>Name</th>
                      <th style={{ textAlign: "center", padding: "10px" }}>Weight %</th>
                      <th style={{ textAlign: "center", padding: "10px" }}>Marks</th>
                      <th style={{ textAlign: "center", padding: "10px" }}>Duration</th>
                      <th style={{ textAlign: "center", padding: "10px" }}>Paper</th>
                      <th style={{ textAlign: "center", padding: "10px" }}>Flags</th>
                      <th style={{ textAlign: "left", padding: "10px" }}>Description</th>
                      <th style={{ textAlign: "center", padding: "10px" }}>Source</th>
                      <th style={{ textAlign: "center", padding: "10px" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAssessments.map((a) => (
                      <tr key={a.programme_id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        {editingId === a.programme_id ? (
                          <>
                            <td colSpan={11} style={{ padding: "12px", background: "#eff6ff" }}>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px" }}>
                                <div>
                                  <label style={{ fontSize: "11px", fontWeight: 600 }}>Name</label>
                                  <input value={editForm.assessment_name || ""} onChange={(e) => setEditForm({ ...editForm, assessment_name: e.target.value })} style={{ width: "100%", padding: "4px", fontSize: "12px" }} />
                                </div>
                                <div>
                                  <label style={{ fontSize: "11px", fontWeight: 600 }}>Type</label>
                                  <select value={editForm.assessment_type || "test"} onChange={(e) => setEditForm({ ...editForm, assessment_type: e.target.value })} style={{ width: "100%", padding: "4px", fontSize: "12px" }}>
                                    <option value="test">Test</option>
                                    <option value="examination">Examination</option>
                                    <option value="practical">Practical</option>
                                    <option value="project">Project</option>
                                    <option value="midyear_examination">Midyear Examination</option>
                                  </select>
                                </div>
                                <div>
                                  <label style={{ fontSize: "11px", fontWeight: 600 }}>Term</label>
                                  <select value={editForm.term || "1"} onChange={(e) => setEditForm({ ...editForm, term: e.target.value })} style={{ width: "100%", padding: "4px", fontSize: "12px" }}>
                                    <option value="1">1</option>
                                    <option value="2">2</option>
                                    <option value="3">3</option>
                                    <option value="4">4</option>
                                  </select>
                                </div>
                                <div>
                                  <label style={{ fontSize: "11px", fontWeight: 600 }}>Weight %</label>
                                  <input type="number" value={editForm.weighting_percent || "0"} onChange={(e) => setEditForm({ ...editForm, weighting_percent: e.target.value })} style={{ width: "100%", padding: "4px", fontSize: "12px" }} />
                                </div>
                                <div>
                                  <label style={{ fontSize: "11px", fontWeight: 600 }}>Marks</label>
                                  <input type="number" value={editForm.total_marks || 0} onChange={(e) => setEditForm({ ...editForm, total_marks: parseInt(e.target.value) || 0 })} style={{ width: "100%", padding: "4px", fontSize: "12px" }} />
                                </div>
                                <div>
                                  <label style={{ fontSize: "11px", fontWeight: 600 }}>Duration</label>
                                  <input value={editForm.duration_hours || ""} onChange={(e) => setEditForm({ ...editForm, duration_hours: e.target.value || null })} style={{ width: "100%", padding: "4px", fontSize: "12px" }} />
                                </div>
                                <div>
                                  <label style={{ fontSize: "11px", fontWeight: 600 }}>Paper #</label>
                                  <input type="number" value={editForm.paper_number || ""} onChange={(e) => setEditForm({ ...editForm, paper_number: e.target.value ? parseInt(e.target.value) : null })} style={{ width: "100%", padding: "4px", fontSize: "12px" }} />
                                </div>
                                <div style={{ display: "flex", gap: "8px", alignItems: "end" }}>
                                  <label style={{ fontSize: "11px", display: "flex", alignItems: "center", gap: "3px" }}>
                                    <input type="checkbox" checked={!!editForm.is_examination} onChange={(e) => setEditForm({ ...editForm, is_examination: e.target.checked ? 1 : 0 })} /> Exam
                                  </label>
                                  <label style={{ fontSize: "11px", display: "flex", alignItems: "center", gap: "3px" }}>
                                    <input type="checkbox" checked={!!editForm.is_practical} onChange={(e) => setEditForm({ ...editForm, is_practical: e.target.checked ? 1 : 0 })} /> Practical
                                  </label>
                                  <label style={{ fontSize: "11px", display: "flex", alignItems: "center", gap: "3px" }}>
                                    <input type="checkbox" checked={!!editForm.is_formal} onChange={(e) => setEditForm({ ...editForm, is_formal: e.target.checked ? 1 : 0 })} /> Formal
                                  </label>
                                </div>
                                <div style={{ gridColumn: "1 / -1" }}>
                                  <label style={{ fontSize: "11px", fontWeight: 600 }}>Description</label>
                                  <textarea value={editForm.description || ""} onChange={(e) => setEditForm({ ...editForm, description: e.target.value || null })} rows={2} style={{ width: "100%", padding: "4px", fontSize: "12px" }} />
                                </div>
                                <div style={{ gridColumn: "1 / -1", display: "flex", gap: "8px" }}>
                                  <button onClick={saveEdit} disabled={saving} style={{ padding: "6px 14px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>
                                    {saving ? "Saving..." : "Save"}
                                  </button>
                                  <button onClick={cancelEdit} style={{ padding: "6px 14px", background: "#e5e7eb", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>Cancel</button>
                                </div>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={{ padding: "10px" }}>{a.term}</td>
                            <td style={{ padding: "10px" }}>
                              <span style={{
                                display: "inline-block",
                                padding: "2px 8px",
                                borderRadius: "4px",
                                fontSize: "11px",
                                fontWeight: 600,
                                textTransform: "uppercase",
                                background: a.is_examination ? "#fef3c7" : a.is_practical ? "#d1fae5" : "#f3f4f6",
                                color: a.is_examination ? "#92400e" : a.is_practical ? "#065f46" : "#374151",
                              }}>
                                {a.assessment_type}
                              </span>
                            </td>
                            <td style={{ padding: "10px", fontWeight: 500 }}>{a.assessment_name}</td>
                            <td style={{ padding: "10px", textAlign: "center", fontWeight: 600 }}>{a.weighting_percent}%</td>
                            <td style={{ padding: "10px", textAlign: "center" }}>{a.total_marks}</td>
                            <td style={{ padding: "10px", textAlign: "center" }}>{a.duration_hours || "-"}</td>
                            <td style={{ padding: "10px", textAlign: "center" }}>{a.paper_number || "-"}</td>
                            <td style={{ padding: "10px", textAlign: "center", fontSize: "11px" }}>
                                  {a.is_examination ? "Exam " : ""} {a.is_practical ? "Practical " : ""} {a.is_formal ? "Formal" : ""}
                                </td>
                                <td style={{ padding: "10px", maxWidth: "300px", color: "#666", fontSize: "12px" }}>
                                  {a.description || "-"}
                                </td>
                                <td style={{ padding: "10px", textAlign: "center", fontSize: "11px" }}>
                                  {a.source_document ? (
                                    <span style={{ color: "#16a34a", fontWeight: 600 }}>PDF</span>
                                  ) : (
                                    <span style={{ color: "#9ca3af" }}>Manual</span>
                                  )}
                                </td>
                                <td style={{ padding: "10px", textAlign: "center" }}>
                                  <button onClick={() => startEdit(a)} style={{ marginRight: "6px", padding: "4px 10px", fontSize: "11px", cursor: "pointer", borderRadius: "4px", border: "1px solid #d1d5db", background: "#fff" }}>Edit</button>
                                  <button onClick={() => handleDelete(a.programme_id)} style={{ padding: "4px 10px", fontSize: "11px", cursor: "pointer", borderRadius: "4px", border: "1px solid #fca5a5", background: "#fee2e2", color: "#991b1b" }}>Delete</button>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                        {sortedAssessments.length === 0 && (
                          <tr>
                            <td colSpan={11} style={{ padding: "24px", textAlign: "center", color: "#9ca3af" }}>
                              No assessments found for Grade {activeGrade}.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}

          {!loading && !data && subjectCode && (
            <div style={{ color: "#9ca3af", textAlign: "center", padding: "40px" }}>
              No assessment programme data found for this subject.
            </div>
          )}
        </div>
      );
    };

    export default CapsReviewDashboard;

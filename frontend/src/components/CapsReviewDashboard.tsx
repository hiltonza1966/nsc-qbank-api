import React, { useState, useEffect } from "react";

const API_BASE = "http://localhost:4000";

interface SubjectOption {
  subject_official_code: string;
  subject_alpha_code: string;
  subject_name: string;
}

interface ATPContent {
  grade: number;
  term: string;
  week_range: string;
  paper_no: number;
  paper_code: string;
  topic: string;
  subtopic: string;
  caps_ref: string;
  source_url: string;
}

interface PoAContent extends ATPContent {
  programme_of_assessment: string | null;
  weight_sba_pct: number | null;
  cognitive_level: string | null;
}

const CapsReviewDashboard: React.FC = () => {
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [subjectCode, setSubjectCode] = useState<string>("");
  const [atpData, setAtpData] = useState<ATPContent[]>([]);
  const [poaData, setPoaData] = useState<PoAContent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeGrade, setActiveGrade] = useState<number>(10);
  const [activeView, setActiveView] = useState<"atp" | "poa">("atp");

  // Fetch subjects from caps_subjects_master
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
            subject_alpha_code: s.subject_alpha_code,
            subject_name: s.subject_name,
          })));
        } else {
          throw new Error("Invalid subjects response format");
        }
      })
      .catch((err) => setError(`Failed to load subjects list: ${err.message}`));
  }, []);

  // Fetch ATP and PoA content when subject changes
  useEffect(() => {
    if (!subjectCode) return;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`${API_BASE}/api/caps/content/${subjectCode}`).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }),
      fetch(`${API_BASE}/api/caps/poa/${subjectCode}`).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
    ])
      .then(([atpRes, poaRes]) => {
        const atpList = atpRes.content || [];
        const poaList = poaRes.poa || [];
        setAtpData(atpList);
        setPoaData(poaList);

        // Set active grade to first available
        const grades = (Array.from(new Set(atpList.map((a: ATPContent) => a.grade))) as number[]).sort((a, b) => a - b);
        if (grades.length > 0) {
          setActiveGrade(grades[0]);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [subjectCode]);

  const availableGrades = React.useMemo(() => {
    const grades = Array.from(new Set(atpData.map((a) => a.grade))) as number[];
    return grades.sort((a, b) => a - b);
  }, [atpData]);

  const filteredAtp = React.useMemo(() => {
    return atpData.filter((a) => a.grade === activeGrade);
  }, [atpData, activeGrade]);

  const filteredPoa = React.useMemo(() => {
    return poaData.filter((a) => a.grade === activeGrade);
  }, [poaData, activeGrade]);

  const termOrder: Record<string, number> = {
    "T1": 1, "1": 1,
    "T2": 2, "2": 2,
    "T3": 3, "3": 3,
    "T4": 4, "4": 4,
  };

  const sortedAtp = React.useMemo(() => {
    return [...filteredAtp].sort((a, b) => {
      const ta = termOrder[a.term] || 99;
      const tb = termOrder[b.term] || 99;
      if (ta !== tb) return ta - tb;
      return a.topic.localeCompare(b.topic);
    });
  }, [filteredAtp]);

  const sortedPoa = React.useMemo(() => {
    return [...filteredPoa].sort((a, b) => {
      const ta = termOrder[a.term] || 99;
      const tb = termOrder[b.term] || 99;
      if (ta !== tb) return ta - tb;
      return a.topic.localeCompare(b.topic);
    });
  }, [filteredPoa]);

  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ marginBottom: "8px" }}>CAPS Content Review</h1>
      <p style={{ color: "#666", marginBottom: "24px" }}>
        Review CAPS ATP and PoA content seeded from CAPS documents.
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
          onChange={(e) => setSubjectCode(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #ccc", minWidth: "280px", fontSize: "14px" }}
        >
          <option value="">-- Select a subject --</option>
          {subjects.map((s) => (
            <option key={s.subject_official_code} value={s.subject_official_code}>
              {s.subject_name} ({s.subject_official_code})
            </option>
          ))}
        </select>
        {subjectCode && (
          <span style={{ color: "#666", fontSize: "14px" }}>
            Loaded: <strong>{subjects.find((s) => s.subject_official_code === subjectCode)?.subject_name || subjectCode}</strong>
          </span>
        )}
      </div>

      {loading && <div style={{ color: "#666" }}>Loading CAPS content...</div>}

      {!loading && subjectCode && (
        <>
          {/* View Toggle */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
            <button
              onClick={() => setActiveView("atp")}
              style={{
                padding: "8px 20px",
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
                background: activeView === "atp" ? "#2563eb" : "#f3f4f6",
                color: activeView === "atp" ? "#fff" : "#374151",
              }}
            >
              Annual Teaching Plan (ATP)
            </button>
            <button
              onClick={() => setActiveView("poa")}
              style={{
                padding: "8px 20px",
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
                background: activeView === "poa" ? "#2563eb" : "#f3f4f6",
                color: activeView === "poa" ? "#fff" : "#374151",
              }}
            >
              Programme of Assessment (PoA)
            </button>
          </div>

          {/* Grade Tabs */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "20px", borderBottom: "2px solid #e5e7eb", paddingBottom: "8px" }}>
            {availableGrades.map((g) => (
              <button
                key={g}
                onClick={() => setActiveGrade(g)}
                style={{
                  padding: "8px 20px",
                  borderRadius: "6px 6px 0 0",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 600,
                  background: activeGrade === g ? "#2563eb" : "#f3f4f6",
                  color: activeGrade === g ? "#fff" : "#374151",
                }}
              >
                Grade {g}
              </button>
            ))}
          </div>

          {/* Content Count */}
          <div style={{ marginBottom: "16px", color: "#666", fontSize: "14px" }}>
            Showing {activeView === "atp" ? sortedAtp.length : sortedPoa.length} rows for Grade {activeGrade}
            {activeView === "atp" && atpData.length > 0 && (
              <span> (Total ATP: {atpData.length} rows)</span>
            )}
            {activeView === "poa" && poaData.length > 0 && (
              <span> (Total PoA: {poaData.length} rows)</span>
            )}
          </div>

          {/* ATP Table */}
          {activeView === "atp" && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                    <th style={{ textAlign: "left", padding: "10px" }}>Term</th>
                    <th style={{ textAlign: "left", padding: "10px" }}>Weeks</th>
                    <th style={{ textAlign: "center", padding: "10px" }}>Paper</th>
                    <th style={{ textAlign: "left", padding: "10px" }}>Topic</th>
                    <th style={{ textAlign: "left", padding: "10px" }}>Subtopic</th>
                    <th style={{ textAlign: "left", padding: "10px" }}>CAPS Ref</th>
                    <th style={{ textAlign: "center", padding: "10px" }}>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAtp.map((a, index) => (
                    <tr key={index} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "10px", fontWeight: 500 }}>{a.term}</td>
                      <td style={{ padding: "10px" }}>{a.week_range}</td>
                      <td style={{ padding: "10px", textAlign: "center" }}>
                        <span style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontSize: "11px",
                          fontWeight: 600,
                          background: a.paper_no === 2 ? "#fef3c7" : "#f3f4f6",
                          color: a.paper_no === 2 ? "#92400e" : "#374151",
                        }}>
                          P{a.paper_no}
                        </span>
                      </td>
                      <td style={{ padding: "10px", fontWeight: 500, maxWidth: "250px" }}>{a.topic}</td>
                      <td style={{ padding: "10px", color: "#666", maxWidth: "300px", fontSize: "12px" }}>{a.subtopic}</td>
                      <td style={{ padding: "10px", fontSize: "12px" }}>{a.caps_ref || "-"}</td>
                      <td style={{ padding: "10px", textAlign: "center", fontSize: "11px" }}>
                        {a.source_url ? (
                          <a href={a.source_url} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb", textDecoration: "none" }}>
                            Link
                          </a>
                        ) : (
                          <span style={{ color: "#9ca3af" }}>-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {sortedAtp.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: "24px", textAlign: "center", color: "#9ca3af" }}>
                        No ATP content found for Grade {activeGrade}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* PoA Table */}
          {activeView === "poa" && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                    <th style={{ textAlign: "left", padding: "10px" }}>Term</th>
                    <th style={{ textAlign: "left", padding: "10px" }}>Weeks</th>
                    <th style={{ textAlign: "center", padding: "10px" }}>Paper</th>
                    <th style={{ textAlign: "left", padding: "10px" }}>Topic</th>
                    <th style={{ textAlign: "left", padding: "10px" }}>Subtopic</th>
                    <th style={{ textAlign: "left", padding: "10px" }}>Assessment</th>
                    <th style={{ textAlign: "center", padding: "10px" }}>SBA %</th>
                    <th style={{ textAlign: "left", padding: "10px" }}>Cognitive</th>
                    <th style={{ textAlign: "left", padding: "10px" }}>CAPS Ref</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPoa.map((a, index) => (
                    <tr key={index} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "10px", fontWeight: 500 }}>{a.term}</td>
                      <td style={{ padding: "10px" }}>{a.week_range}</td>
                      <td style={{ padding: "10px", textAlign: "center" }}>
                        <span style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontSize: "11px",
                          fontWeight: 600,
                          background: a.paper_no === 2 ? "#fef3c7" : "#f3f4f6",
                          color: a.paper_no === 2 ? "#92400e" : "#374151",
                        }}>
                          P{a.paper_no}
                        </span>
                      </td>
                      <td style={{ padding: "10px", fontWeight: 500, maxWidth: "200px" }}>{a.topic}</td>
                      <td style={{ padding: "10px", color: "#666", maxWidth: "250px", fontSize: "12px" }}>{a.subtopic}</td>
                      <td style={{ padding: "10px", fontSize: "12px" }}>{a.programme_of_assessment || <span style={{ color: "#9ca3af" }}>-</span>}</td>
                      <td style={{ padding: "10px", textAlign: "center", fontSize: "12px" }}>
                        {a.weight_sba_pct !== null ? `${a.weight_sba_pct}%` : <span style={{ color: "#9ca3af" }}>-</span>}
                      </td>
                      <td style={{ padding: "10px", fontSize: "12px" }}>{a.cognitive_level || <span style={{ color: "#9ca3af" }}>-</span>}</td>
                      <td style={{ padding: "10px", fontSize: "12px" }}>{a.caps_ref || "-"}</td>
                    </tr>
                  ))}
                  {sortedPoa.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ padding: "24px", textAlign: "center", color: "#9ca3af" }}>
                        No PoA template found for Grade {activeGrade}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {!loading && !subjectCode && (
        <div style={{ color: "#9ca3af", textAlign: "center", padding: "40px" }}>
          Select a subject to view CAPS content.
        </div>
      )}
    </div>
  );
};

export default CapsReviewDashboard;

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";

interface Paper {
  paper_id: string;
  paper_title: string;
  total_marks: number;
  status: string;
  subject_name: string;
  grade_number: number;
  paper_name: string;
  assembled_at: string;
  assembled_by_name: string;
}

const Papers: React.FC = () => {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  useEffect(() => {
    fetchPapers();
  }, [page, statusFilter]);

  async function fetchPapers() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("limit", limit.toString());
      params.append("offset", ((page - 1) * limit).toString());
      if (statusFilter) params.append("status", statusFilter);
      const response = await fetch(`/api/qbank/papers?${params.toString()}`, {
        headers: { "x-user-role": localStorage.getItem("qbank_role") || "author" },
      });
      if (!response.ok) { setPapers([]); setTotal(0); setLoading(false); return; }
      const data = await response.json();
      const paperList = data.data || data.papers || data || [];
      setPapers(paperList);
      setTotal(data.total || paperList.length);
      setLoading(false);
    } catch (err) { setPapers([]); setTotal(0); setLoading(false); }
  }

  const statusColors: Record<string, string> = {
    draft: "#f59e0b", assembled: "#3b82f6", internal_moderated: "#8b5cf6",
    external_moderated: "#6366f1", dbe_approval: "#ec4899", print_ready: "#10b981",
    published: "#059669", archived: "#6b7280",
  };
  const statusLabels: Record<string, string> = {
    draft: "Draft", assembled: "Assembled", internal_moderated: "Internal Moderated",
    external_moderated: "External Moderated", dbe_approval: "DBE Approval",
    print_ready: "Print Ready", published: "Published", archived: "Archived",
  };

  return (
    <div style={{ padding: "24px", fontFamily: "system-ui, sans-serif", maxWidth: "1400px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "bold", color: "#1f2937" }}>Question Papers</h1>
        <Link to="/papers/new" style={{ padding: "10px 20px", background: "#3b82f6", color: "white", textDecoration: "none", borderRadius: "6px", fontWeight: "500" }}>+ Create Paper</Link>
      </div>
      <div style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap" }}>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "14px" }}>
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="assembled">Assembled</option>
          <option value="internal_moderated">Internal Moderated</option>
          <option value="external_moderated">External Moderated</option>
          <option value="print_ready">Print Ready</option>
          <option value="published">Published</option>
        </select>
        {statusFilter && <button onClick={() => { setStatusFilter(""); setPage(1); }} style={{ padding: "8px 16px", background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: "6px", cursor: "pointer", fontSize: "14px" }}>Clear</button>}
      </div>
      <div style={{ marginBottom: "12px", color: "#6b7280", fontSize: "14px" }}>Showing {papers.length} of {total} papers</div>
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px" }}>
          <div style={{ width: "40px", height: "40px", border: "4px solid #e5e7eb", borderTop: "4px solid #3b82f6", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
          <p>Loading papers...</p>
        </div>
      ) : papers.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", background: "#f9fafb", borderRadius: "8px", border: "2px dashed #d1d5db" }}>
          <p style={{ fontSize: "18px", color: "#6b7280", marginBottom: "16px" }}>No papers found</p>
          <p style={{ fontSize: "14px", color: "#9ca3af" }}>{statusFilter ? "Try adjusting your filters." : "Get started by creating your first paper."}</p>
          {!statusFilter && <Link to="/papers/new" style={{ display: "inline-block", marginTop: "16px", padding: "10px 20px", background: "#3b82f6", color: "white", textDecoration: "none", borderRadius: "6px" }}>Create Paper</Link>}
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", background: "white", borderRadius: "8px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", color: "#374151" }}>Paper Title</th>
                <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: "600", color: "#374151" }}>Marks</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", color: "#374151" }}>Subject</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", color: "#374151" }}>Grade</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", color: "#374151" }}>Status</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", color: "#374151" }}>Assembled</th>
                <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: "600", color: "#374151" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {papers.map((paper) => (
                <tr key={paper.paper_id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "12px 16px" }}>
                    <Link to={`/papers/${paper.paper_id}`} style={{ color: "#3b82f6", textDecoration: "none", fontWeight: "500" }}>{paper.paper_title || "Untitled Paper"}</Link>
                    <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "2px" }}>{paper.paper_name || "Paper"}</div>
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center", fontWeight: "600", color: "#1f2937" }}>{paper.total_marks}</td>
                  <td style={{ padding: "12px 16px", color: "#4b5563" }}>{paper.subject_name || "â€”"}</td>
                  <td style={{ padding: "12px 16px", color: "#4b5563" }}>{paper.grade_number ? `Grade ${paper.grade_number}` : "â€”"}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ display: "inline-block", padding: "4px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: "500", background: `${statusColors[paper.status] || "#6b7280"}15`, color: statusColors[paper.status] || "#6b7280" }}>
                      {statusLabels[paper.status] || paper.status}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", color: "#6b7280", fontSize: "13px" }}>{paper.assembled_at ? new Date(paper.assembled_at).toLocaleDateString() : "â€”"}</td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    <Link to={`/papers/${paper.paper_id}`} style={{ padding: "6px 12px", background: "#f3f4f6", color: "#374151", textDecoration: "none", borderRadius: "4px", fontSize: "13px" }}>View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {total > limit && (
        <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "24px" }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: "8px 16px", background: page === 1 ? "#f3f4f6" : "white", color: page === 1 ? "#9ca3af" : "#374151", border: "1px solid #d1d5db", borderRadius: "6px", cursor: page === 1 ? "not-allowed" : "pointer" }}>Previous</button>
          <span style={{ padding: "8px 16px", color: "#6b7280" }}>Page {page} of {Math.ceil(total / limit)}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / limit)} style={{ padding: "8px 16px", background: page >= Math.ceil(total / limit) ? "#f3f4f6" : "white", color: page >= Math.ceil(total / limit) ? "#9ca3af" : "#374151", border: "1px solid #d1d5db", borderRadius: "6px", cursor: page >= Math.ceil(total / limit) ? "not-allowed" : "pointer" }}>Next</button>
        </div>
      )}
    </div>
  );
};

export default Papers;

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";

interface ReviewItem {
  item_id: string;
  item_code: string;
  question_number: string;
  question_text: string;
  marks: number;
  status: string;
  subject_name: string;
  grade_number: number;
  cognitive_level_name: string;
  difficulty_name: string;
  current_reviewer_role: string;
  days_pending: number;
}

const Reviews: React.FC = () => {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");

  useEffect(() => {
    fetchReviews();
  }, [roleFilter, subjectFilter]);

  async function fetchReviews() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (roleFilter) params.append("reviewer_role", roleFilter);
      if (subjectFilter) params.append("subject", subjectFilter);
      const response = await fetch(`/api/qbank/items/pending?${params.toString()}`, {
        headers: { "x-user-role": localStorage.getItem("qbank_role") || "author" },
      });
      if (!response.ok) { setItems([]); setLoading(false); return; }
      const data = await response.json();
      const itemList = data.data || data.items || data || [];
      setItems(itemList);
      setLoading(false);
    } catch (err) { setItems([]); setLoading(false); }
  }

  const statusColors: Record<string, string> = {
    subject_specialist_review: "#f59e0b", pending_review: "#3b82f6",
    peer_approved: "#8b5cf6", expert_approved: "#6366f1", qa_review: "#ec4899",
  };
  const statusLabels: Record<string, string> = {
    subject_specialist_review: "Subject Specialist Review", pending_review: "Peer Review",
    peer_approved: "Expert Review", expert_approved: "QA Review", qa_review: "Moderator Review",
  };
  const roleLabels: Record<string, string> = {
    subject_specialist: "Subject Specialist", peer_reviewer: "Peer Reviewer",
    subject_expert: "Subject Expert", qa_reviewer: "QA Reviewer", moderator: "Moderator",
  };

  return (
    <div style={{ padding: "24px", fontFamily: "system-ui, sans-serif", maxWidth: "1400px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "bold", color: "#1f2937" }}>Review Queue</h1>
        <div style={{ fontSize: "14px", color: "#6b7280" }}>{items.length} items pending review</div>
      </div>
      <div style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap" }}>
        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); }} style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "14px" }}>
          <option value="">My Role</option>
          <option value="subject_specialist">Subject Specialist</option>
          <option value="peer_reviewer">Peer Reviewer</option>
          <option value="subject_expert">Subject Expert</option>
          <option value="qa_reviewer">QA Reviewer</option>
          <option value="moderator">Moderator</option>
        </select>
        <select value={subjectFilter} onChange={(e) => { setSubjectFilter(e.target.value); }} style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "14px" }}>
          <option value="">All Subjects</option>
          <option value="LIFE_SC">Life Sciences</option>
          <option value="MATH">Mathematics</option>
          <option value="PHYS">Physical Sciences</option>
          <option value="ACCOUNTING">Accounting</option>
        </select>
        {(roleFilter || subjectFilter) && <button onClick={() => { setRoleFilter(""); setSubjectFilter(""); }} style={{ padding: "8px 16px", background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: "6px", cursor: "pointer", fontSize: "14px" }}>Clear</button>}
      </div>
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px" }}>
          <div style={{ width: "40px", height: "40px", border: "4px solid #e5e7eb", borderTop: "4px solid #3b82f6", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
          <p>Loading review queue...</p>
        </div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", background: "#f9fafb", borderRadius: "8px", border: "2px dashed #d1d5db" }}>
          <p style={{ fontSize: "18px", color: "#6b7280", marginBottom: "16px" }}>No items pending review</p>
          <p style={{ fontSize: "14px", color: "#9ca3af" }}>{roleFilter || subjectFilter ? "Try adjusting your filters." : "All caught up! Check back later."}</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", background: "white", borderRadius: "8px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", color: "#374151" }}>Item</th>
                <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: "600", color: "#374151" }}>Marks</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", color: "#374151" }}>Subject</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", color: "#374151" }}>Review Stage</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", color: "#374151" }}>Assigned To</th>
                <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: "600", color: "#374151" }}>Days</th>
                <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: "600", color: "#374151" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.item_id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "12px 16px" }}>
                    <Link to={`/items/${item.item_id}`} style={{ color: "#3b82f6", textDecoration: "none", fontWeight: "500", fontFamily: "monospace" }}>{item.item_code || item.item_id.substring(0, 8)}</Link>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "250px", color: "#6b7280", fontSize: "13px", marginTop: "2px" }}>{item.question_text || "No question text"}</div>
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center", fontWeight: "600", color: "#1f2937" }}>{item.marks}</td>
                  <td style={{ padding: "12px 16px", color: "#4b5563" }}>{item.subject_name || "â€”"}<div style={{ fontSize: "12px", color: "#9ca3af" }}>Grade {item.grade_number || "â€”"} Â· {item.cognitive_level_name || ""}</div></td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ display: "inline-block", padding: "4px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: "500", background: `${statusColors[item.status] || "#6b7280"}15`, color: statusColors[item.status] || "#6b7280" }}>{statusLabels[item.status] || item.status}</span>
                  </td>
                  <td style={{ padding: "12px 16px", color: "#4b5563", fontSize: "13px" }}>{roleLabels[item.current_reviewer_role] || item.current_reviewer_role || "â€”"}</td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    <span style={{ color: (item.days_pending || 0) > 3 ? "#dc2626" : "#6b7280", fontWeight: (item.days_pending || 0) > 3 ? "600" : "normal" }}>{item.days_pending || 0}d</span>
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    <Link to={`/items/${item.item_id}`} style={{ padding: "6px 12px", background: "#3b82f6", color: "white", textDecoration: "none", borderRadius: "4px", fontSize: "13px" }}>Review</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Reviews;

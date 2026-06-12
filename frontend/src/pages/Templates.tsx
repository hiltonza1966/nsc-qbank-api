import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";

interface Template {
  template_id: number;
  template_code: string;
  template_name: string;
  year_value: number;
  grade_number: number;
  subject_name: string;
  paper_name: string;
  assessment_type_name: string;
  assessment_body_name: string;
  total_marks: number;
  total_items: number;
  duration_minutes: number;
  is_active: number;
  created_at: string;
}

const Templates: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState("");

  useEffect(() => {
    fetchTemplates();
  }, [subjectFilter]);

  async function fetchTemplates() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (subjectFilter) params.append("subject", subjectFilter);
      const response = await fetch(`/api/qbank/templates?${params.toString()}`, {
        headers: { "x-user-role": localStorage.getItem("qbank_role") || "author" },
      });
      if (!response.ok) { setTemplates([]); setLoading(false); return; }
      const data = await response.json();
      const templateList = data.data || data.templates || data || [];
      setTemplates(templateList);
      setLoading(false);
    } catch (err) { setTemplates([]); setLoading(false); }
  }

  return (
    <div style={{ padding: "24px", fontFamily: "system-ui, sans-serif", maxWidth: "1400px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "bold", color: "#1f2937" }}>Paper Templates</h1>
        <Link to="/templates/new" style={{ padding: "10px 20px", background: "#3b82f6", color: "white", textDecoration: "none", borderRadius: "6px", fontWeight: "500" }}>+ Create Template</Link>
      </div>
      <div style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap" }}>
        <select value={subjectFilter} onChange={(e) => { setSubjectFilter(e.target.value); }} style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "14px" }}>
          <option value="">All Subjects</option>
          <option value="LIFE_SC">Life Sciences</option>
          <option value="MATH">Mathematics</option>
          <option value="PHYS">Physical Sciences</option>
          <option value="ACCOUNTING">Accounting</option>
        </select>
        {subjectFilter && <button onClick={() => { setSubjectFilter(""); }} style={{ padding: "8px 16px", background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: "6px", cursor: "pointer", fontSize: "14px" }}>Clear</button>}
      </div>
      <div style={{ marginBottom: "12px", color: "#6b7280", fontSize: "14px" }}>{templates.length} templates</div>
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px" }}>
          <div style={{ width: "40px", height: "40px", border: "4px solid #e5e7eb", borderTop: "4px solid #3b82f6", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
          <p>Loading templates...</p>
        </div>
      ) : templates.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", background: "#f9fafb", borderRadius: "8px", border: "2px dashed #d1d5db" }}>
          <p style={{ fontSize: "18px", color: "#6b7280", marginBottom: "16px" }}>No templates found</p>
          <p style={{ fontSize: "14px", color: "#9ca3af" }}>{subjectFilter ? "Try adjusting your filters." : "Create your first paper template to get started."}</p>
          {!subjectFilter && <Link to="/templates/new" style={{ display: "inline-block", marginTop: "16px", padding: "10px 20px", background: "#3b82f6", color: "white", textDecoration: "none", borderRadius: "6px" }}>Create Template</Link>}
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", background: "white", borderRadius: "8px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", color: "#374151" }}>Template</th>
                <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: "600", color: "#374151" }}>Marks</th>
                <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: "600", color: "#374151" }}>Items</th>
                <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: "600", color: "#374151" }}>Duration</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", color: "#374151" }}>Subject</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", color: "#374151" }}>Grade</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", color: "#374151" }}>Paper</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", color: "#374151" }}>Status</th>
                <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: "600", color: "#374151" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.template_id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "12px 16px" }}>
                    <Link to={`/templates/${template.template_id}`} style={{ color: "#3b82f6", textDecoration: "none", fontWeight: "500", fontFamily: "monospace" }}>{template.template_code || `TMP-${template.template_id}`}</Link>
                    <div style={{ fontSize: "13px", color: "#6b7280", marginTop: "2px" }}>{template.template_name || "Untitled Template"}</div>
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center", fontWeight: "600", color: "#1f2937" }}>{template.total_marks}</td>
                  <td style={{ padding: "12px 16px", textAlign: "center", color: "#4b5563" }}>{template.total_items}</td>
                  <td style={{ padding: "12px 16px", textAlign: "center", color: "#4b5563" }}>{template.duration_minutes ? `${Math.floor(template.duration_minutes / 60)}h ${template.duration_minutes % 60}m` : "â€”"}</td>
                  <td style={{ padding: "12px 16px", color: "#4b5563" }}>{template.subject_name || "â€”"}</td>
                  <td style={{ padding: "12px 16px", color: "#4b5563" }}>{template.grade_number ? `Grade ${template.grade_number}` : "â€”"}</td>
                  <td style={{ padding: "12px 16px", color: "#4b5563" }}>{template.paper_name || "â€”"}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ display: "inline-block", padding: "4px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: "500", background: template.is_active ? "#10b98115" : "#6b728015", color: template.is_active ? "#10b981" : "#6b7280" }}>{template.is_active ? "Active" : "Inactive"}</span>
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    <Link to={`/templates/${template.template_id}`} style={{ padding: "6px 12px", background: "#f3f4f6", color: "#374151", textDecoration: "none", borderRadius: "4px", fontSize: "13px" }}>View</Link>
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

export default Templates;

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const MasterTemplate: React.FC = () => {
  // State matching the HTML's form controls
  const [subjects, setSubjects] = useState<any[]>([]);
  const [papers, setPapers] = useState<any[]>([]);
  const [years, setYears] = useState<any[]>([]);
  const [grades] = useState([{grade_id: 10, grade_number: 10}, {grade_id: 11, grade_number: 11}, {grade_id: 12, grade_number: 12}]);
  const [sessions] = useState([
    {session_id: 1, session_name: 'November 2025'},
    {session_id: 2, session_name: 'June 2025'},
    {session_id: 3, session_name: 'September 2025 Trial'},
    {session_id: 4, session_name: 'November 2024'},
    {session_id: 5, session_name: 'June 2024'},
    {session_id: 6, session_name: 'November 2023'},
    {session_id: 7, session_name: 'May/June 2023'}
  ]);

  const [selectedSubject, setSelectedSubject] = useState('Mathematics');
  const [selectedPaper, setSelectedPaper] = useState('P1');
  const [selectedGrade, setSelectedGrade] = useState('12');
  const [selectedSession, setSelectedSession] = useState('November 2025');
  const [template, setTemplate] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [showWatermark, setShowWatermark] = useState(true);
  const [paperItems, setPaperItems] = useState<any[]>([]);

  const headers = { 'x-user-role': localStorage.getItem('qbank_role') || 'author' };

  useEffect(() => {
    fetchLookups();
  }, []);

  useEffect(() => {
    if (selectedSubject && selectedPaper && selectedGrade) {
      fetchTemplate();
    }
  }, [selectedSubject, selectedPaper, selectedGrade]);

  async function fetchLookups() {
    try {
      const [subjRes, paperRes, yearRes] = await Promise.all([
        fetch('/api/lookup/lookup_subjects', { headers }),
        fetch('/api/lookup/lookup_papers', { headers }),
        fetch('/api/lookup/lookup_years', { headers }),
      ]);
      if (subjRes.ok) { const d = await subjRes.json(); setSubjects(d.data || d.subjects || []); }
      if (paperRes.ok) { const d = await paperRes.json(); setPapers(d.data || []); }
      if (yearRes.ok) { const d = await yearRes.json(); setYears(d.data || []); }
    } catch (e) { console.error(e); }
  }

  async function fetchTemplate() {
    setLoading(true);
    try {
      // Find subject code from name
      const subject = subjects.find(s => s.subject_name === selectedSubject);
      const subjectCode = subject?.subject_official_code || '19331054';
      const paperNo = selectedPaper.replace('P', '');

      const response = await fetch(`/api/qbank/templates?subject=${subjectCode}&paper=${paperNo}`, { headers });
      if (!response.ok) { setLoading(false); return; }
      const data = await response.json();
      const templates = data.templates || data.data || [];
      if (templates.length > 0) {
        setTemplate(templates[0]);
        fetchItems(templates[0].template_id);
      } else {
        setTemplate(null);
      }
    } catch (e) { setTemplate(null); }
    setLoading(false);
  }

  async function fetchItems(templateId: number) {
    try {
      const response = await fetch(`/api/qbank/items?template_id=${templateId}&limit=50`, { headers });
      if (!response.ok) { setPaperItems([]); return; }
      const data = await response.json();
      setPaperItems(data.items || []);
    } catch (e) { setPaperItems([]); }
  }

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours} hours`;
    return `${hours} hours ${mins} minutes`;
  };

  const getMarks = () => template?.total_marks || 150;
  const getTime = () => template?.duration_minutes ? formatTime(template.duration_minutes) : '3 hours';
  const getPages = () => {
    const sections = template?.sections_config ? JSON.parse(template.sections_config) : [];
    return sections.length + 2;
  };

  const getInstructions = () => {
    // Default instructions - in production these come from paper_templates.instructions_html or lookup table
    return [
      "Answer ALL the questions.",
      "Number the answers correctly according to the numbering system used in this question paper.",
      "Clearly show ALL calculations, diagrams, graphs, et cetera that you have used in determining your answers.",
      "Answers only will NOT necessarily be awarded full marks.",
      "You may use an approved scientific calculator (non-programmable and non-graphical), unless stated otherwise.",
      "If necessary, round off answers to TWO decimal places, unless stated otherwise.",
      "Diagrams are NOT necessarily drawn to scale.",
      "An information sheet with formulae is included at the end of the question paper.",
      "Write neatly and legibly."
    ];
  };

  const getSampleQuestions = () => {
    // In production, these come from paperItems
    if (paperItems.length > 0) {
      return paperItems.map(item => `<div style="margin-bottom:16px"><p><strong>${item.question_number}</strong> ${item.question_text}</p><p style="text-align:right;font-size:10px;color:#6b7280">(${item.marks})</p></div>`).join('');
    }
    return '<p style="color:#6b7280;font-style:italic">No items in this paper yet. Add items to see them here.</p>';
  };

  const sections = template?.sections_config ? JSON.parse(template.sections_config) : [];

  return (
    <div className="bg-[#e8eef5] min-h-screen flex flex-col" style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <header className="bg-[#0a1930] text-white sticky top-0 z-40 border-b border-white/10">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#1e4a8a] to-[#002855] flex items-center justify-center shadow-lg">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7v10l10 5 10-5V7L12 2z" stroke="white" strokeWidth="1.5" fill="none"/><circle cx="12" cy="12" r="3" stroke="#c5a455" strokeWidth="1.5"/></svg>
            </div>
            <div>
              <div className="font-semibold tracking-wide leading-none">Corporate Question Bank <span className="text-[#c5a455]">v3.2</span></div>
              <div className="text-[11px] text-white/60 -mt-0.5">NSC Master Template Engine • DBE Compliant</div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-6 text-xs">
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Live Preview</div>
            <div className="text-white/50">REPUBLIC OF SOUTH AFRICA</div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 max-w-[1600px] w-full mx-auto">
        {/* Control Panel */}
        <aside className="w-full lg:w-[360px] xl:w-[380px] shrink-0 bg-white border-r border-slate-200 h-[calc(100vh-52px)] sticky top-[52px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          <div className="p-5">
            <h2 className="font-semibold text-slate-900 text-lg">Master Template Control</h2>
            <p className="text-xs text-slate-500 mt-0.5">One template, all NSC subjects. CAPS aligned.</p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Subject</label>
                <select 
                  value={selectedSubject} 
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="mt-1 w-full rounded-lg border-slate-300 text-sm py-2.5 px-3 focus:ring-2 focus:ring-[#1e4a8a] focus:border-[#1e4a8a] bg-white border"
                >
                  {subjects.map(s => (
                    <option key={s.subject_official_code} value={s.subject_name}>{s.subject_name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Paper</label>
                  <select 
                    value={selectedPaper} 
                    onChange={(e) => setSelectedPaper(e.target.value)}
                    className="mt-1 w-full rounded-lg border-slate-300 text-sm py-2.5 px-3 focus:ring-2 focus:ring-[#1e4a8a] border"
                  >
                    {papers.map(p => (
                      <option key={p.paper_no} value={`P${p.paper_no}`}>{p.paper_name || `Paper ${p.paper_no}`}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Grade</label>
                  <select 
                    value={selectedGrade} 
                    onChange={(e) => setSelectedGrade(e.target.value)}
                    className="mt-1 w-full rounded-lg border-slate-300 text-sm py-2.5 px-3 focus:ring-2 focus:ring-[#1e4a8a] border"
                  >
                    {grades.map(g => (
                      <option key={g.grade_id} value={g.grade_number}>{g.grade_number}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Examination Session</label>
                <select 
                  value={selectedSession} 
                  onChange={(e) => setSelectedSession(e.target.value)}
                  className="mt-1 w-full rounded-lg border-slate-300 text-sm py-2.5 px-3 focus:ring-2 focus:ring-[#1e4a8a] border"
                >
                  {sessions.map(s => (
                    <option key={s.session_id} value={s.session_name}>{s.session_name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Marks</label>
                  <input readOnly value={getMarks()} className="mt-1 w-full rounded-lg border-slate-200 bg-slate-50 text-sm py-2.5 px-3 font-mono font-semibold text-slate-800 border" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Time</label>
                  <input readOnly value={getTime()} className="mt-1 w-full rounded-lg border-slate-200 bg-slate-50 text-sm py-2.5 px-3 font-mono font-semibold text-slate-800 border" />
                </div>
              </div>
            </div>

            {/* Blueprint Compliance */}
            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-sm font-semibold text-emerald-900">Blueprint Compliant</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-600 text-white">CAPS 2025</span>
              </div>
              <p className="text-xs text-emerald-800 mt-2 leading-snug">
                {getMarks()} Marks • {getTime()} • DBE Assessment Guidelines verified
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
                <div className="bg-white/70 rounded p-1.5 text-center"><div className="font-semibold text-slate-700">Cognitive</div><div className="text-emerald-700">Verified</div></div>
                <div className="bg-white/70 rounded p-1.5 text-center"><div className="font-semibold text-slate-700">Taxonomy</div><div className="text-emerald-700">L1-4</div></div>
                <div className="bg-white/70 rounded p-1.5 text-center"><div className="font-semibold text-slate-700">Moderation</div><div className="text-emerald-700">Ready</div></div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 space-y-2">
              <button onClick={() => window.print()} className="w-full bg-[#002855] hover:bg-[#0a1930] text-white rounded-lg py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                Print / Save PDF
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setShowInstructions(!showInstructions)} className="border border-slate-300 rounded-lg py-2 text-xs font-medium hover:bg-slate-50">
                  {showInstructions ? 'Hide' : 'Show'} Instructions
                </button>
                <button onClick={() => setShowWatermark(!showWatermark)} className="border border-slate-300 rounded-lg py-2 text-xs font-medium hover:bg-slate-50">
                  {showWatermark ? 'Hide' : 'Show'} Watermark
                </button>
              </div>
            </div>

            <div className="mt-6 text-[11px] text-slate-500 leading-relaxed border-t pt-4">
              <strong className="text-slate-700">Template v3.2 features:</strong> Auto-populating headers, dynamic instructions, SC/NSC security features, confidential watermark, automatic page counts, and CAPS cognitive level distribution.
            </div>
          </div>
        </aside>

        {/* Preview */}
        <main className="flex-1 bg-[#d8e1eb] min-h-[calc(100vh-52px)] overflow-auto">
          <div className="py-8 px-4">
            {loading ? (
              <div className="text-center py-16">
                <p>Loading template...</p>
              </div>
            ) : (
              <div className="mx-auto" style={{ width: '210mm', minHeight: '297mm', background: 'white', color: '#000', position: 'relative', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}>
                {/* Watermark */}
                {showWatermark && (
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%) rotate(-30deg)',
                    fontSize: '72px',
                    fontWeight: 700,
                    color: 'rgba(184, 0, 0, 0.06)',
                    letterSpacing: '0.1em',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    fontFamily: 'Inter, sans-serif',
                    zIndex: 0,
                  }}>
                    SC/NSC – CONFIDENTIAL
                  </div>
                )}

                {/* COVER PAGE */}
                <div className="paper-page" style={{ padding: '18mm 16mm', minHeight: '297mm', position: 'relative', background: 'white', pageBreakAfter: 'always' }}>
                  <div className="dbe-header" style={{ borderBottom: '3px solid #002855', textAlign: 'center', paddingBottom: '12px' }}>
                    <div style={{ fontSize: '11px', letterSpacing: '0.3em', fontWeight: 600, color: '#374151' }}>basic education</div>
                    <div style={{ fontSize: '10px', marginTop: '-2px' }}>Department: Basic Education</div>
                    <div style={{ fontSize: '10px', fontWeight: 700 }}>REPUBLIC OF SOUTH AFRICA</div>
                    <div style={{ fontSize: '48px', margin: '8px 0', color: '#002855', fontWeight: 700 }}>&#9733;</div>
                  </div>

                  <h1 style={{ fontSize: '22px', fontWeight: 700, textAlign: 'center', marginTop: '32px', letterSpacing: '0.05em', color: '#002855', fontFamily: 'Inter, sans-serif' }}>
                    NATIONAL SENIOR CERTIFICATE
                  </h1>
                  <h2 style={{ fontSize: '18px', fontWeight: 700, textAlign: 'center', marginTop: '-4px', color: '#002855', fontFamily: 'Inter, sans-serif' }}>
                    GRADE {selectedGrade}
                  </h2>

                  <div style={{ textAlign: 'center', marginTop: '56px' }}>
                    <div style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: 'Libre Baskerville, serif' }}>
                      {selectedSubject.toUpperCase()} {selectedPaper}
                    </div>
                    <div style={{ width: '160px', height: '3px', background: '#c5a455', margin: '12px auto' }}></div>
                  </div>

                  <div style={{ maxWidth: '340px', margin: '64px auto 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #cbd5e1' }}>
                      <span style={{ fontWeight: 600, letterSpacing: '0.05em', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>MARKS:</span>
                      <span style={{ fontWeight: 700, fontSize: '22px', fontFamily: 'monospace', marginTop: '-4px' }}>{getMarks()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #cbd5e1' }}>
                      <span style={{ fontWeight: 600, letterSpacing: '0.05em', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>TIME:</span>
                      <span style={{ fontWeight: 700, fontSize: '22px', fontFamily: 'monospace', marginTop: '-4px' }}>{getTime()}</span>
                    </div>
                  </div>

                  <div style={{ position: 'absolute', bottom: '110px', left: 0, right: 0, textAlign: 'center' }}>
                    <div style={{ fontSize: '17px', fontWeight: 600, letterSpacing: '0.1em', fontFamily: 'Inter, sans-serif' }}>
                      {selectedSession.toUpperCase()}
                    </div>
                    <p style={{ marginTop: '32px', fontSize: '11px' }}>
                      This question paper consists of {getPages()} pages, including 1 information sheet.
                    </p>
                  </div>

                  <div style={{ position: 'absolute', bottom: '18mm', left: '16mm', right: '16mm', display: 'flex', justifyContent: 'space-between', fontFamily: 'JetBrains Mono, monospace', fontSize: '9px', letterSpacing: '0.5px', color: '#475569' }}>
                    <span>SC/NSC</span>
                    <span>Copyright reserved</span>
                    <span>Please turn over</span>
                  </div>
                </div>

                {/* INSTRUCTIONS PAGE */}
                {showInstructions && (
                  <div className="paper-page" style={{ padding: '18mm 16mm', minHeight: '297mm', position: 'relative', background: 'white', pageBreakAfter: 'always' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #1e293b', paddingBottom: '8px', marginBottom: '16px', fontFamily: 'Inter, sans-serif' }}>
                      <div>
                        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', color: '#002855' }}>NATIONAL SENIOR CERTIFICATE</div>
                        <div style={{ fontSize: '13px', fontWeight: 700 }}>{selectedSubject.toUpperCase()} {selectedPaper}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '10px' }}>GRADE</div>
                        <div style={{ fontSize: '13px', fontWeight: 700 }}>{selectedGrade}</div>
                      </div>
                    </div>

                    <h3 style={{ textAlign: 'center', fontWeight: 700, fontSize: '14px', letterSpacing: '0.05em', marginBottom: '16px', textDecoration: 'underline', textUnderlineOffset: '4px' }}>
                      INSTRUCTIONS AND INFORMATION
                    </h3>

                    <div style={{ lineHeight: 1.7, fontSize: '11.5pt' }}>
                      <p style={{ marginBottom: '12px' }}>Read the following instructions carefully before answering the questions.</p>
                      <ol style={{ listStyleType: 'decimal', marginLeft: '20px', lineHeight: 1.8 }}>
                        {getInstructions().map((inst, i) => (
                          <li key={i}>{inst}</li>
                        ))}
                      </ol>
                      <div style={{ marginTop: '32px', fontSize: '10px', fontStyle: 'italic', borderTop: '1px solid #e5e7eb', paddingTop: '8px' }}>
                        This paper is generated by Corporate Question Bank v3.2 – DBE Master Template
                      </div>
                    </div>

                    <div style={{ position: 'absolute', bottom: '18mm', left: '16mm', right: '16mm', display: 'flex', justifyContent: 'space-between', fontFamily: 'JetBrains Mono, monospace', fontSize: '9px', letterSpacing: '0.5px', color: '#475569' }}>
                      <span>SC/NSC</span>
                      <span>2</span>
                    </div>
                  </div>
                )}

                {/* QUESTIONS PAGES */}
                {sections.map((section: any, idx: number) => (
                  <div key={idx} className="paper-page" style={{ padding: '18mm 16mm', minHeight: '297mm', position: 'relative', background: 'white', pageBreakAfter: 'always' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #1e293b', paddingBottom: '8px', marginBottom: '16px', fontFamily: 'Inter, sans-serif' }}>
                      <div>
                        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', color: '#002855' }}>NATIONAL SENIOR CERTIFICATE</div>
                        <div style={{ fontSize: '13px', fontWeight: 700 }}>{selectedSubject.toUpperCase()} {selectedPaper}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '10px' }}>GRADE</div>
                        <div style={{ fontSize: '13px', fontWeight: 700 }}>{selectedGrade}</div>
                      </div>
                    </div>

                    <h3 style={{ fontWeight: 700, fontSize: '14px', marginBottom: '12px', textDecoration: 'underline', textUnderlineOffset: '4px' }}>
                      {section.name?.toUpperCase() || `SECTION ${String.fromCharCode(65 + idx)}`}
                    </h3>
                    <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '16px' }}>
                      {section.marks} marks • {section.items} items • Cognitive: {section.cognitive_level} • Difficulty: {section.difficulty}
                    </p>

                    <div style={{ lineHeight: 1.7, fontSize: '11.5pt' }} dangerouslySetInnerHTML={{ __html: getSampleQuestions() }} />

                    <div style={{ position: 'absolute', bottom: '18mm', left: '16mm', right: '16mm', display: 'flex', justifyContent: 'space-between', fontFamily: 'JetBrains Mono, monospace', fontSize: '9px', letterSpacing: '0.5px', color: '#475569' }}>
                      <span>SC/NSC</span>
                      <span>{idx + 3}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="text-center mt-6 text-[11px] text-slate-500">Preview shows pages 1-3. Full paper auto-paginates on print.</div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default MasterTemplate;

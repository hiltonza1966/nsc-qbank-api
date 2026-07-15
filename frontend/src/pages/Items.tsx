import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';

interface Item {
  item_id: string;
  item_code: string;
  question_number: string;
  question_text: string;
  marks: number;
  status: string;
  subject_name: string;
  grade_number: number;
  paper_name: string;
  cognitive_level_name: string;
  difficulty_name: string;
  item_type_name: string;
  created_at: string;
  has_attachments?: number;
  has_memo?: number;
}

interface LookupItem {
  id: number;
  name: string;
  code?: string;
}

const Items: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  // Search & basic filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Metadata filters (all database-driven)
  const [subjectFilter, setSubjectFilter] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [paperFilter, setPaperFilter] = useState('');
  const [itemTypeFilter, setItemTypeFilter] = useState('');
  const [cognitiveLevelFilter, setCognitiveLevelFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [minMarks, setMinMarks] = useState('');
  const [maxMarks, setMaxMarks] = useState('');
  const [hasAttachments, setHasAttachments] = useState('');
  const [hasMemo, setHasMemo] = useState('');
  const [createdAfter, setCreatedAfter] = useState('');
  const [createdBefore, setCreatedBefore] = useState('');

  // Lookup data (database-driven, no hardcoding)
  const [subjects, setSubjects] = useState<LookupItem[]>([]);
  const [grades, setGrades] = useState<LookupItem[]>([]);
  const [papers, setPapers] = useState<LookupItem[]>([]);
  const [itemTypes, setItemTypes] = useState<LookupItem[]>([]);
  const [cognitiveLevels, setCognitiveLevels] = useState<LookupItem[]>([]);
  const [difficulties, setDifficulties] = useState<LookupItem[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [lookupsLoaded, setLookupsLoaded] = useState(false);

  // Fetch lookup tables on mount
  useEffect(() => {
    fetchLookups();
  }, []);

  // Fetch items when filters or page change
  useEffect(() => {
    fetchItems();
  }, [page, statusFilter, subjectFilter, gradeFilter, paperFilter, itemTypeFilter,
      cognitiveLevelFilter, difficultyFilter, hasAttachments, hasMemo]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (page !== 1) setPage(1);
      else fetchItems();
    }, 400);
    return () => clearTimeout(timer);
  }, [search, minMarks, maxMarks, createdAfter, createdBefore]);

  async function fetchLookups() {
    const headers = {
      'x-user-role': localStorage.getItem('qbank_role') || 'author',
      'x-user-id': localStorage.getItem('qbank_user_id') || '1',
    };

    const endpoints = [
      { url: '/api/lookup/lookup_subjects', setter: setSubjects, nameField: 'subject_name', idField: 'subject_id' },
      { url: '/api/lookup/lookup_grades', setter: setGrades, nameField: 'grade_name', idField: 'grade_id', altName: 'grade_number' },
      { url: '/api/lookup/lookup_papers', setter: setPapers, nameField: 'paper_name', idField: 'paper_id', altName: 'paper_no' },
      { url: '/api/lookup/lookup_item_types', setter: setItemTypes, nameField: 'type_name', idField: 'item_type_id' },
      { url: '/api/lookup/lookup_cognitive_levels', setter: setCognitiveLevels, nameField: 'level_name', idField: 'cognitive_level_id' },
      { url: '/api/lookup/lookup_difficulty_levels', setter: setDifficulties, nameField: 'difficulty_name', idField: 'difficulty_id' },
    ];

    for (const ep of endpoints) {
      try {
        const res = await fetch(ep.url, { headers });
        if (!res.ok) continue;
        const data = await res.json();
        const rows = data.data || data || [];
        const mapped = rows.map((r: any) => ({
          id: r[ep.idField] || r.id || 0,
          name: r[ep.nameField] || r.name || (ep.altName ? r[ep.altName] : undefined) || `ID ${r[ep.idField]}`,
          code: r.subject_official_code || r.type_code || r.session_code || r.paper_code || String(r[ep.idField]),
        })).filter((r: LookupItem) => r.id && r.name);
        ep.setter(mapped);
      } catch (e) {
        console.error(`Failed to fetch ${ep.url}:`, e);
      }
    }
    setLookupsLoaded(true);
  }

  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    params.append('offset', ((page - 1) * limit).toString());

    if (search.trim()) params.append('search', search.trim());
    if (statusFilter) params.append('status', statusFilter);
    if (subjectFilter) params.append('subject_official_code', subjectFilter);
    if (gradeFilter) params.append('grade_id', gradeFilter);
    if (paperFilter) params.append('paper_no', paperFilter);
    if (itemTypeFilter) params.append('item_type_id', itemTypeFilter);
    if (cognitiveLevelFilter) params.append('cognitive_level_id', cognitiveLevelFilter);
    if (difficultyFilter) params.append('difficulty_id', difficultyFilter);
    if (minMarks) params.append('min_marks', minMarks);
    if (maxMarks) params.append('max_marks', maxMarks);
    if (hasAttachments) params.append('has_attachments', hasAttachments);
    if (hasMemo) params.append('has_memo', hasMemo);
    if (createdAfter) params.append('created_after', createdAfter);
    if (createdBefore) params.append('created_before', createdBefore);

    return params;
  }, [page, search, statusFilter, subjectFilter, gradeFilter, paperFilter,
      itemTypeFilter, cognitiveLevelFilter, difficultyFilter, minMarks, maxMarks,
      hasAttachments, hasMemo, createdAfter, createdBefore]);

  async function fetchItems() {
    setLoading(true);
    setError(null);
    try {
      const params = buildQueryParams();
      const response = await fetch(`/api/qbank/items?${params.toString()}`, {
        headers: {
          'x-user-role': localStorage.getItem('qbank_role') || 'author',
          'x-user-id': localStorage.getItem('qbank_user_id') || '1',
        },
      });

      if (!response.ok) {
        setItems([]);
        setTotal(0);
        setLoading(false);
        return;
      }

      const data = await response.json();
      const itemList = data.items || data.data || [];
      setItems(itemList);
      setTotal(data.total || itemList.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch items');
      setItems([]);
      setTotal(0);
    }
    setLoading(false);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    fetchItems();
  }

  function clearAllFilters() {
    setSearch('');
    setStatusFilter('');
    setSubjectFilter('');
    setGradeFilter('');
    setPaperFilter('');
    setItemTypeFilter('');
    setCognitiveLevelFilter('');
    setDifficultyFilter('');
    setMinMarks('');
    setMaxMarks('');
    setHasAttachments('');
    setHasMemo('');
    setCreatedAfter('');
    setCreatedBefore('');
    setPage(1);
    // fetchItems will trigger via useEffect when page changes
  }

  const activeFilterCount = [
    statusFilter, subjectFilter, gradeFilter, paperFilter,
    itemTypeFilter, cognitiveLevelFilter, difficultyFilter,
    minMarks, maxMarks, hasAttachments, hasMemo, createdAfter, createdBefore
  ].filter(Boolean).length;

  const statusColors: Record<string, string> = {
    draft: '#f59e0b',
    pending_review: '#3b82f6',
    peer_approved: '#8b5cf6',
    expert_approved: '#6366f1',
    qa_review: '#ec4899',
    approved: '#10b981',
    published: '#059669',
    archived: '#6b7280',
  };

  const statusLabels: Record<string, string> = {
    draft: 'Draft',
    pending_review: 'Pending Review',
    peer_approved: 'Peer Approved',
    expert_approved: 'Expert Approved',
    qa_review: 'QA Review',
    approved: 'Approved',
    published: 'Published',
    archived: 'Archived',
  };

  // Helper to get active filter badges
  const getFilterBadges = () => {
    const badges: Array<{ label: string; clear: () => void }> = [];
    if (statusFilter) badges.push({ label: `Status: ${statusLabels[statusFilter] || statusFilter}`, clear: () => setStatusFilter('') });
    if (subjectFilter) {
      const subj = subjects.find(s => s.code === subjectFilter);
      badges.push({ label: `Subject: ${subj?.name || subjectFilter}`, clear: () => setSubjectFilter('') });
    }
    if (gradeFilter) {
      const gr = grades.find(g => String(g.id) === gradeFilter);
      badges.push({ label: `Grade: ${gr?.name || gradeFilter}`, clear: () => setGradeFilter('') });
    }
    if (paperFilter) {
      const p = papers.find(p => String(p.id) === paperFilter);
      badges.push({ label: `Paper: ${p?.name || paperFilter}`, clear: () => setPaperFilter('') });
    }
    if (itemTypeFilter) {
      const t = itemTypes.find(t => String(t.id) === itemTypeFilter);
      badges.push({ label: `Type: ${t?.name || itemTypeFilter}`, clear: () => setItemTypeFilter('') });
    }
    if (cognitiveLevelFilter) {
      const c = cognitiveLevels.find(c => String(c.id) === cognitiveLevelFilter);
      badges.push({ label: `Cognitive: ${c?.name || cognitiveLevelFilter}`, clear: () => setCognitiveLevelFilter('') });
    }
    if (difficultyFilter) {
      const d = difficulties.find(d => String(d.id) === difficultyFilter);
      badges.push({ label: `Difficulty: ${d?.name || difficultyFilter}`, clear: () => setDifficultyFilter('') });
    }
    if (minMarks || maxMarks) badges.push({ label: `Marks: ${minMarks || '0'}-${maxMarks || '∞'}`, clear: () => { setMinMarks(''); setMaxMarks(''); } });
    if (hasAttachments) badges.push({ label: `Attachments: ${hasAttachments === '1' ? 'Yes' : 'No'}`, clear: () => setHasAttachments('') });
    if (hasMemo) badges.push({ label: `Memo: ${hasMemo === '1' ? 'Yes' : 'No'}`, clear: () => setHasMemo('') });
    if (createdAfter) badges.push({ label: `From: ${createdAfter}`, clear: () => setCreatedAfter('') });
    if (createdBefore) badges.push({ label: `To: ${createdBefore}`, clear: () => setCreatedBefore('') });
    return badges;
  };

  return (
    <div style={{ padding: '24px', fontFamily: 'system-ui, sans-serif', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1f2937' }}>Item Bank</h1>
        <Link to="/items/new" style={{
          padding: '10px 20px',
          background: '#3b82f6',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '6px',
          fontWeight: '500',
        }}>
          + Create Item
        </Link>
      </div>

      {/* Search Bar + Filter Toggle */}
      <form onSubmit={handleSearch} style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '16px',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        <input
          type="text"
          placeholder="Search items (text, code, number)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: '10px 14px',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            fontSize: '14px',
            minWidth: '280px',
            flex: 1,
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          style={{
            padding: '10px 16px',
            background: showFilters ? '#dbeafe' : '#f3f4f6',
            color: showFilters ? '#1e40af' : '#374151',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>🔍</span>
          Filters
          {activeFilterCount > 0 && (
            <span style={{
              background: '#3b82f6',
              color: 'white',
              borderRadius: '10px',
              padding: '2px 8px',
              fontSize: '12px',
              fontWeight: 'bold',
            }}>
              {activeFilterCount}
            </span>
          )}
        </button>
        <button
          type="submit"
          style={{
            padding: '10px 20px',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          Search
        </button>
        {(activeFilterCount > 0 || search) && (
          <button
            type="button"
            onClick={clearAllFilters}
            style={{
              padding: '10px 16px',
              background: '#fef2f2',
              color: '#dc2626',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            Clear All
          </button>
        )}
      </form>

      {/* Active Filter Badges */}
      {activeFilterCount > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600 }}>Active:</span>
          {getFilterBadges().map((badge, idx) => (
            <span
              key={idx}
              onClick={badge.clear}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 12px',
                background: '#dbeafe',
                color: '#1e40af',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                border: '1px solid #bfdbfe',
              }}
              title="Click to remove"
            >
              {badge.label}
              <span style={{ fontWeight: 'bold', marginLeft: '2px' }}>×</span>
            </span>
          ))}
        </div>
      )}

      {/* Expandable Filter Panel */}
      {showFilters && (
        <div style={{
          background: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
            {/* Status */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '6px', textTransform: 'uppercase' }}>
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  background: 'white',
                }}
              >
                <option value="">All Statuses</option>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            {/* Subject — database-driven */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '6px', textTransform: 'uppercase' }}>
                Subject
              </label>
              <select
                value={subjectFilter}
                onChange={(e) => { setSubjectFilter(e.target.value); setPage(1); }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  background: 'white',
                }}
                disabled={!lookupsLoaded}
              >
                <option value="">All Subjects</option>
                {subjects.map(s => (
                  <option key={s.code} value={s.code}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Grade — database-driven */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '6px', textTransform: 'uppercase' }}>
                Grade
              </label>
              <select
                value={gradeFilter}
                onChange={(e) => { setGradeFilter(e.target.value); setPage(1); }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  background: 'white',
                }}
                disabled={!lookupsLoaded}
              >
                <option value="">All Grades</option>
                {grades.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            {/* Paper — database-driven */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '6px', textTransform: 'uppercase' }}>
                Paper
              </label>
              <select
                value={paperFilter}
                onChange={(e) => { setPaperFilter(e.target.value); setPage(1); }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  background: 'white',
                }}
                disabled={!lookupsLoaded}
              >
                <option value="">All Papers</option>
                {papers.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Item Type — database-driven */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '6px', textTransform: 'uppercase' }}>
                Item Type
              </label>
              <select
                value={itemTypeFilter}
                onChange={(e) => { setItemTypeFilter(e.target.value); setPage(1); }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  background: 'white',
                }}
                disabled={!lookupsLoaded}
              >
                <option value="">All Types</option>
                {itemTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Cognitive Level — database-driven */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '6px', textTransform: 'uppercase' }}>
                Cognitive Level
              </label>
              <select
                value={cognitiveLevelFilter}
                onChange={(e) => { setCognitiveLevelFilter(e.target.value); setPage(1); }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  background: 'white',
                }}
                disabled={!lookupsLoaded}
              >
                <option value="">All Levels</option>
                {cognitiveLevels.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Difficulty — database-driven */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '6px', textTransform: 'uppercase' }}>
                Difficulty
              </label>
              <select
                value={difficultyFilter}
                onChange={(e) => { setDifficultyFilter(e.target.value); setPage(1); }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  background: 'white',
                }}
                disabled={!lookupsLoaded}
              >
                <option value="">All Difficulties</option>
                {difficulties.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Marks Range */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '6px', textTransform: 'uppercase' }}>
                Marks Range
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="number"
                  placeholder="Min"
                  value={minMarks}
                  onChange={(e) => { setMinMarks(e.target.value); setPage(1); }}
                  style={{
                    width: '50%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                  min={0}
                  max={100}
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={maxMarks}
                  onChange={(e) => { setMaxMarks(e.target.value); setPage(1); }}
                  style={{
                    width: '50%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                  min={0}
                  max={100}
                />
              </div>
            </div>

            {/* Has Attachments */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '6px', textTransform: 'uppercase' }}>
                Attachments
              </label>
              <select
                value={hasAttachments}
                onChange={(e) => { setHasAttachments(e.target.value); setPage(1); }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  background: 'white',
                }}
              >
                <option value="">All</option>
                <option value="1">Has Attachments</option>
                <option value="0">No Attachments</option>
              </select>
            </div>

            {/* Has Memo */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '6px', textTransform: 'uppercase' }}>
                Memo
              </label>
              <select
                value={hasMemo}
                onChange={(e) => { setHasMemo(e.target.value); setPage(1); }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  background: 'white',
                }}
              >
                <option value="">All</option>
                <option value="1">Has Memo</option>
                <option value="0">No Memo</option>
              </select>
            </div>

            {/* Created After */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '6px', textTransform: 'uppercase' }}>
                Created From
              </label>
              <input
                type="date"
                value={createdAfter}
                onChange={(e) => { setCreatedAfter(e.target.value); setPage(1); }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              />
            </div>

            {/* Created Before */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '6px', textTransform: 'uppercase' }}>
                Created To
              </label>
              <input
                type="date"
                value={createdBefore}
                onChange={(e) => { setCreatedBefore(e.target.value); setPage(1); }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Results count */}
      <div style={{ marginBottom: '12px', color: '#6b7280', fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Showing {items.length} of {total} items</span>
        {loading && <span style={{ color: '#3b82f6', fontSize: '13px' }}>Loading...</span>}
      </div>

      {/* Error message */}
      {error && (
        <div style={{
          background: '#fef2f2',
          color: '#dc2626',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '16px',
          fontSize: '14px',
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Table */}
      {loading && items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{
            width: '40px', height: '40px',
            border: '4px solid #e5e7eb', borderTop: '4px solid #3b82f6',
            borderRadius: '50%', animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p>Loading items...</p>
        </div>
      ) : items.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: '#f9fafb',
          borderRadius: '8px',
          border: '2px dashed #d1d5db',
        }}>
          <p style={{ fontSize: '18px', color: '#6b7280', marginBottom: '16px' }}>
            No items found
          </p>
          <p style={{ fontSize: '14px', color: '#9ca3af' }}>
            {activeFilterCount > 0 || search
              ? 'Try adjusting your search or filters.'
              : 'Get started by creating your first item.'}
          </p>
          {!activeFilterCount && !search && (
            <Link to="/items/new" style={{
              display: 'inline-block',
              marginTop: '16px',
              padding: '10px 20px',
              background: '#3b82f6',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '6px',
            }}>
              Create Item
            </Link>
          )}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '14px',
            background: 'white',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '12px', textTransform: 'uppercase' }}>Item Code</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '12px', textTransform: 'uppercase' }}>Question</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#374151', fontSize: '12px', textTransform: 'uppercase' }}>Marks</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '12px', textTransform: 'uppercase' }}>Subject</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '12px', textTransform: 'uppercase' }}>Grade</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '12px', textTransform: 'uppercase' }}>Type</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '12px', textTransform: 'uppercase' }}>Cognitive</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '12px', textTransform: 'uppercase' }}>Difficulty</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '12px', textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#374151', fontSize: '12px', textTransform: 'uppercase' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.item_id} style={{ borderBottom: '1px solid #f3f4f6', transition: 'background 0.15s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <Link to={`/items/${item.item_id}`} style={{
                      color: '#3b82f6',
                      textDecoration: 'none',
                      fontWeight: '500',
                      fontFamily: 'monospace',
                      fontSize: '13px',
                    }}>
                      {item.item_code || item.item_id.substring(0, 8)}
                    </Link>
                  </td>
                  <td style={{ padding: '12px 16px', maxWidth: '280px' }}>
                    <div style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: '#1f2937',
                      fontSize: '13px',
                    }}>
                      {item.question_text || 'No question text'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                      Q{item.question_number || '?'}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#1f2937', fontSize: '13px' }}>
                    {item.marks}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#4b5563', fontSize: '13px' }}>
                    {item.subject_name || '—'}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#4b5563', fontSize: '13px' }}>
                    {item.grade_number ? `Grade ${item.grade_number}` : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#4b5563', fontSize: '13px' }}>
                    {item.item_type_name || '—'}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#4b5563', fontSize: '13px' }}>
                    {item.cognitive_level_name || '—'}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#4b5563', fontSize: '13px' }}>
                    {item.difficulty_name || '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: '500',
                      background: `${statusColors[item.status] || '#6b7280'}15`,
                      color: statusColors[item.status] || '#6b7280',
                    }}>
                      {statusLabels[item.status] || item.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <Link to={`/items/${item.item_id}`} style={{
                      padding: '6px 12px',
                      background: '#f3f4f6',
                      color: '#374151',
                      textDecoration: 'none',
                      borderRadius: '4px',
                      fontSize: '13px',
                      fontWeight: 500,
                    }}>
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > limit && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '24px' }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{
              padding: '8px 16px',
              background: page === 1 ? '#f3f4f6' : 'white',
              color: page === 1 ? '#9ca3af' : '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              cursor: page === 1 ? 'not-allowed' : 'pointer',
              fontSize: '14px',
            }}
          >
            Previous
          </button>
          <span style={{ padding: '8px 16px', color: '#6b7280', fontSize: '14px' }}>
            Page {page} of {Math.ceil(total / limit)}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= Math.ceil(total / limit)}
            style={{
              padding: '8px 16px',
              background: page >= Math.ceil(total / limit) ? '#f3f4f6' : 'white',
              color: page >= Math.ceil(total / limit) ? '#9ca3af' : '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              cursor: page >= Math.ceil(total / limit) ? 'not-allowed' : 'pointer',
              fontSize: '14px',
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default Items;

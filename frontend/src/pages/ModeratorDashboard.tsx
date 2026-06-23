import React, { useState, useEffect } from 'react';
import { MessageSquare, CheckCircle, XCircle, AlertCircle, Clock, User, BookOpen, Filter, Send, History, FileText, BookMarked, Archive } from 'lucide-react';

interface ModeratorItem {
  item_id: string;
  item_code: string;
  question_number: string;
  question_text: string;
  marks: number;
  marks_allocated: number;
  status: string;
  parser_confidence: string;
  source_paper_code: string;
  subject_name: string;
  subject_alpha_code: string;
  review_counts: Record<string, number>;
  peer_review_date: string;
  expert_review_date: string;
}

interface ReviewComment {
  review_id: number;
  reviewer_name: string;
  reviewer_role: string;
  review_type: string;
  comment: string;
  status: string;
  created_at: string;
}

interface WorkflowEntry {
  workflow_id: number;
  current_state: string;
  previous_state: string;
  changed_by_name: string;
  changed_by_role: string;
  transition_reason: string;
  created_at: string;
}

const ModeratorDashboard: React.FC = () => {
  const [items, setItems] = useState<ModeratorItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ModeratorItem | null>(null);
  const [reviewThreads, setReviewThreads] = useState<Record<string, ReviewComment[]>>({});
  const [workflowHistory, setWorkflowHistory] = useState<WorkflowEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    comment: '',
    decision: 'approve',
    review_type: 'moderation',
    transition_reason: ''
  });
  const [userId, setUserId] = useState('1');
  const [filterSubject, setFilterSubject] = useState('');
  const [subjects, setSubjects] = useState<{subject_id: string, subject_name: string, subject_alpha_code: string}[]>([]);
  const [activeTab, setActiveTab] = useState<'review' | 'history' | 'threads' | 'qp_memo'>('review');
  const [qpMemoData, setQpMemoData] = useState<{qp_text: string, memo_text: string, qp_marks: number, memo_marks: number} | null>(null);
  const [auditLog, setAuditLog] = useState<WorkflowEntry[]>([]);

  useEffect(() => {
    fetchItems();
    fetchSubjects();
  }, [filterSubject]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      let url = `/api/v2/review/items-for-review?user_id=${userId}&role=moderator`;
      if (filterSubject) url += `&subject_id=${filterSubject}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) setItems(data.items || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchSubjects = async () => {
    try {
      const res = await fetch('/api/lookup/lookup_subjects');
      const data = await res.json();
      const mappedSubjects = (data.data || []).map((s: any) => ({
        subject_id: s.subject_official_code,
        subject_name: s.subject_name,
        subject_alpha_code: s.subject_official_code
      }));
      setSubjects(mappedSubjects);
    } catch (e) { console.error(e); }
  };

  const fetchReviewThreads = async (itemId: string) => {
    try {
      const res = await fetch(`/api/v2/review/review-threads/${itemId}`);
      const data = await res.json();
      if (data.success) setReviewThreads(data.threads || {});
    } catch (e) { console.error(e); }
  };

  const fetchWorkflowHistory = async (itemId: string) => {
    try {
      const res = await fetch(`/api/v2/review/workflow-history/${itemId}`);
      const data = await res.json();
      if (data.success) {
        setWorkflowHistory(data.history || []);
        setAuditLog(data.history || []);
      }
    } catch (e) { console.error(e); }
  };

  const fetchQpMemo = async (itemId: string) => {
    try {
      const res = await fetch(`/api/v2/review/item-qp-memo/${itemId}`);
      const data = await res.json();
      if (data.success) setQpMemoData(data.qp_memo || null);
    } catch (e) { 
      console.error(e); 
      setQpMemoData(null);
    }
  };

  const handleItemSelect = (item: ModeratorItem) => {
    setSelectedItem(item);
    fetchReviewThreads(item.item_id);
    fetchWorkflowHistory(item.item_id);
    fetchQpMemo(item.item_id);
    setReviewForm({ comment: '', decision: 'approve', review_type: 'moderation', transition_reason: '' });
    setActiveTab('review');
  };

  const handleSubmitReview = async () => {
    if (!selectedItem) return;
    try {
      const res = await fetch('/api/v2/review/submit-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: selectedItem.item_id,
          reviewer_id: userId,
          reviewer_role: 'moderator',
          review_type: reviewForm.review_type,
          comment: reviewForm.comment,
          decision: reviewForm.decision,
          transition_reason: reviewForm.transition_reason
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchItems();
        fetchReviewThreads(selectedItem.item_id);
        fetchWorkflowHistory(selectedItem.item_id);
        setReviewForm({ comment: '', decision: 'approve', review_type: 'moderation', transition_reason: '' });
      }
    } catch (e) { console.error(e); }
  };

  const handlePublish = async () => {
    if (!selectedItem) return;
    try {
      const res = await fetch('/api/v2/review/publish-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: selectedItem.item_id,
          moderator_id: userId,
          publish_reason: reviewForm.transition_reason || 'Published after moderator approval'
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchItems();
        fetchWorkflowHistory(selectedItem.item_id);
        setSelectedItem(null);
      }
    } catch (e) { console.error(e); }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'peer_approved': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'expert_approved': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'moderated': return 'bg-green-50 text-green-700 border-green-200';
      case 'published': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'revision_required': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return <Clock className="w-3 h-3" />;
      case 'peer_approved': return <CheckCircle className="w-3 h-3" />;
      case 'expert_approved': return <CheckCircle className="w-3 h-3" />;
      case 'moderated': return <CheckCircle className="w-3 h-3" />;
      case 'published': return <Archive className="w-3 h-3" />;
      case 'revision_required': return <AlertCircle className="w-3 h-3" />;
      default: return <Clock className="w-3 h-3" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Moderator Dashboard</h1>
          <p className="text-gray-600">Review expert-approved items, moderate content, and publish to production</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Moderator ID</label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-24 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Subject Filter</label>
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Subjects</option>
              {subjects.map(subject => (
                <option key={subject.subject_id} value={subject.subject_id}>
                  {subject.subject_name} ({subject.subject_alpha_code})
                </option>
              ))}
            </select>
          </div>
          <div className="ml-auto flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-lg">
            <Filter className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">
              {items.length} items for <strong>Moderator</strong>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-4 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col max-h-[calc(100vh-280px)]">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-gray-600" />
              <span className="font-semibold text-gray-800">Expert-Approved Items</span>
            </div>
            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                  <span className="text-gray-500 text-sm">Loading items...</span>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {items.map(item => (
                    <div
                      key={item.item_id}
                      onClick={() => handleItemSelect(item)}
                      className={`p-4 cursor-pointer transition-all ${selectedItem?.item_id === item.item_id
                        ? 'bg-blue-50 border-l-4 border-blue-500'
                        : 'hover:bg-gray-50 border-l-4 border-transparent'}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-mono text-sm font-bold text-blue-600">{item.question_number}</span>
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${getStatusColor(item.status)}`}>
                          {getStatusIcon(item.status)}
                          {item.status}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mb-2 font-medium">{item.source_paper_code}</div>
                      <div className="text-sm text-gray-700 line-clamp-2 mb-2 leading-relaxed">{item.question_text || 'No question text available'}</div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <span className="font-medium">Marks:</span> {item.marks ?? 0}/{item.marks_allocated ?? 0}
                        </span>
                        {item.peer_review_date && (
                          <span className="text-blue-600">Peer: {new Date(item.peer_review_date).toLocaleDateString()}</span>
                        )}
                        {item.expert_review_date && (
                          <span className="text-purple-600">Expert: {new Date(item.expert_review_date).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                      <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                      <p>No expert-approved items pending moderation</p>
                      <p className="text-xs mt-1">Items must be peer-approved and expert-approved first</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="col-span-8 space-y-6">
            {selectedItem ? (
              <>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{selectedItem.question_number}</h2>
                      <p className="text-sm text-gray-600 mt-1">{selectedItem.source_paper_code} | {selectedItem.subject_name} ({selectedItem.subject_alpha_code})</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(selectedItem.status)}`}>
                      {getStatusIcon(selectedItem.status)}
                      {selectedItem.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Question Text</div>
                      <div className="text-sm text-gray-800 leading-relaxed">{selectedItem.question_text || 'No question text available'}</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Metadata</div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-gray-600">Marks Allocated:</span> <span className="font-medium">{selectedItem.marks_allocated ?? 'N/A'}</span></div>
                        <div className="flex justify-between"><span className="text-gray-600">Extracted Marks:</span> <span className="font-medium">{selectedItem.marks ?? 'N/A'}</span></div>
                        <div className="flex justify-between"><span className="text-gray-600">Confidence:</span> <span className="font-medium">{selectedItem.parser_confidence || 'N/A'}</span></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="flex border-b border-gray-200">
                    <button onClick={() => setActiveTab('review')} className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'review' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
                      <span className="flex items-center gap-2"><Send className="w-4 h-4" /> Moderate</span>
                    </button>
                    <button onClick={() => setActiveTab('threads')} className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'threads' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
                      <span className="flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Review Threads ({Object.values(reviewThreads).flat().length})</span>
                    </button>
                    <button onClick={() => setActiveTab('history')} className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'history' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
                      <span className="flex items-center gap-2"><History className="w-4 h-4" /> Audit Log ({workflowHistory.length})</span>
                    </button>
                    <button onClick={() => setActiveTab('qp_memo')} className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'qp_memo' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
                      <span className="flex items-center gap-2"><FileText className="w-4 h-4" /> QP & Memo</span>
                    </button>
                  </div>

                  <div className="p-6">
                    {activeTab === 'review' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Moderation Type</label>
                            <select value={reviewForm.review_type} onChange={(e) => setReviewForm({...reviewForm, review_type: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                              <option value="moderation">General Moderation</option>
                              <option value="technical">Technical Verification</option>
                              <option value="curriculum">Curriculum Compliance</option>
                              <option value="language">Language & Grammar</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Decision</label>
                            <select value={reviewForm.decision} onChange={(e) => setReviewForm({...reviewForm, decision: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                              <option value="approve">Approve for Publishing</option>
                              <option value="reject">Reject / Request Revision</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Moderation Comment</label>
                          <textarea value={reviewForm.comment} onChange={(e) => setReviewForm({...reviewForm, comment: e.target.value})} rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none" placeholder="Enter your moderation comments here..." />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Transition Reason (optional)</label>
                          <input type="text" value={reviewForm.transition_reason} onChange={(e) => setReviewForm({...reviewForm, transition_reason: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Reason for moderation decision..." />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <button onClick={handleSubmitReview} className={`w-full py-2.5 px-4 rounded-lg text-white font-medium text-sm transition-all flex items-center justify-center gap-2 ${reviewForm.decision === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
                            <Send className="w-4 h-4" />
                            {reviewForm.decision === 'approve' ? 'Approve for Publishing' : 'Reject / Request Revision'}
                          </button>
                          {selectedItem.status === 'expert_approved' && (
                            <button onClick={handlePublish} className="w-full py-2.5 px-4 rounded-lg text-white font-medium text-sm transition-all flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700">
                              <Archive className="w-4 h-4" />
                              Publish to Production
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {activeTab === 'threads' && (
                      <div className="space-y-4">
                        {Object.keys(reviewThreads).length === 0 ? (
                          <div className="text-center py-8 text-gray-500"><MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-400" /><p>No review threads yet</p></div>
                        ) : (
                          Object.entries(reviewThreads).map(([role, comments]) => (
                            <div key={role} className="border border-gray-200 rounded-lg overflow-hidden">
                              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                                <span className="text-sm font-semibold text-gray-700 flex items-center gap-2"><User className="w-4 h-4" />{role} ({comments.length})</span>
                              </div>
                              <div className="divide-y divide-gray-100">
                                {comments.map((comment) => (
                                  <div key={comment.review_id} className="p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="font-medium text-sm text-gray-900">{comment.reviewer_name || 'Unknown'}</span>
                                      <span className="text-xs text-gray-500">{new Date(comment.created_at).toLocaleString()}</span>
                                      <span className={`text-xs px-2 py-0.5 rounded-full ${comment.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{comment.status}</span>
                                    </div>
                                    <div className="text-sm text-gray-700 mb-1"><span className="font-medium text-xs uppercase tracking-wider text-gray-500">{comment.review_type}</span></div>
                                    <p className="text-sm text-gray-800 leading-relaxed">{comment.comment}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {activeTab === 'history' && (
                      <div className="space-y-3">
                        {workflowHistory.length === 0 ? (
                          <div className="text-center py-8 text-gray-500"><History className="w-8 h-8 mx-auto mb-2 text-gray-400" /><p>No workflow history</p></div>
                        ) : (
                          workflowHistory.map((entry) => (
                            <div key={entry.workflow_id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                              <div className="mt-0.5">
                                {entry.current_state === 'revision_required' ? <XCircle className="w-5 h-5 text-red-500" /> : <CheckCircle className="w-5 h-5 text-green-500" />}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-medium text-gray-900">{entry.changed_by_name || 'Unknown'}</span>
                                  <span className="text-xs text-gray-500">({entry.changed_by_role})</span>
                                  <span className="text-xs text-gray-400">{new Date(entry.created_at).toLocaleString()}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(entry.previous_state)}`}>{entry.previous_state}</span>
                                  <span className="text-gray-400">→</span>
                                  <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(entry.current_state)}`}>{entry.current_state}</span>
                                </div>
                                {entry.transition_reason && <p className="text-sm text-gray-600 mt-1">{entry.transition_reason}</p>}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {activeTab === 'qp_memo' && (
                      <div className="space-y-4">
                        {qpMemoData ? (
                          <div className="grid grid-cols-2 gap-4">
                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                              <div className="bg-blue-50 px-4 py-2 border-b border-gray-200 flex items-center gap-2"><FileText className="w-4 h-4 text-blue-600" /><span className="text-sm font-semibold text-gray-700">Question Paper</span><span className="ml-auto text-xs text-gray-500">Marks: {qpMemoData.qp_marks ?? 'N/A'}</span></div>
                              <div className="p-4"><div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{qpMemoData.qp_text || 'No QP text available'}</div></div>
                            </div>
                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                              <div className="bg-green-50 px-4 py-2 border-b border-gray-200 flex items-center gap-2"><BookMarked className="w-4 h-4 text-green-600" /><span className="text-sm font-semibold text-gray-700">Memo / Answer</span><span className="ml-auto text-xs text-gray-500">Marks: {qpMemoData.memo_marks ?? 'N/A'}</span></div>
                              <div className="p-4"><div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{qpMemoData.memo_text || 'No memo text available'}</div></div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-8 text-gray-500"><FileText className="w-8 h-8 mx-auto mb-2 text-gray-400" /><p>No QP & Memo data available</p></div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">Select an item to moderate</h3>
                <p className="text-gray-500">Click on an item from the list to view details and submit your moderation</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModeratorDashboard;

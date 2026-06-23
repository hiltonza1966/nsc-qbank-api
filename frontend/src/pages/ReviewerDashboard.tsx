import React, { useState, useEffect } from 'react';
import { MessageSquare, CheckCircle, XCircle, AlertCircle, Clock, User, BookOpen, Filter, Send, History, FileText, BookMarked } from 'lucide-react';

interface ReviewItem {
  item_id: string;
  item_code: string;
  question_number: string;
  question_text: string;
  marks: number;
  marks_allocated: number;
  status: string;
  parser_confidence: string;
  source_paper_code: string;
  last_used_date: string;
  subject_name: string;
  subject_alpha_code: string;
  review_counts: Record<string, number>;
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

interface Subject {
  subject_id: string;
  subject_name: string;
  subject_alpha_code: string;
}

const ReviewerDashboard: React.FC = () => {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ReviewItem | null>(null);
  const [reviewThreads, setReviewThreads] = useState<Record<string, ReviewComment[]>>({});
  const [workflowHistory, setWorkflowHistory] = useState<WorkflowEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    comment: '',
    decision: 'approve',
    review_type: 'general',
    transition_reason: ''
  });
  const [userRole, setUserRole] = useState('peer_reviewer');
  const [userId, setUserId] = useState('1');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activeTab, setActiveTab] = useState<'review' | 'history' | 'threads' | 'qp_memo'>('review');
  const [qpMemoData, setQpMemoData] = useState<{qp_text: string, memo_text: string, qp_marks: number, memo_marks: number} | null>(null);

  useEffect(() => {
    fetchItems();
    fetchSubjects();
  }, [userRole, filterStatus, filterSubject]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      let url = `/api/v2/review/items-for-review?user_id=${userId}&role=${userRole}&status=${filterStatus}`;
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
      // API returns {success: true, data: [...]} not {success: true, subjects: [...]}
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
      if (data.success) setWorkflowHistory(data.history || []);
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

  const handleItemSelect = (item: ReviewItem) => {
    setSelectedItem(item);
    fetchReviewThreads(item.item_id);
    fetchWorkflowHistory(item.item_id);
    fetchQpMemo(item.item_id);
    setReviewForm({ comment: '', decision: 'approve', review_type: 'general', transition_reason: '' });
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
          reviewer_role: userRole,
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
        setReviewForm({ comment: '', decision: 'approve', review_type: 'general', transition_reason: '' });
      }
    } catch (e) { console.error(e); }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'peer_approved': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'expert_approved': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'moderated': return 'bg-green-50 text-green-700 border-green-200';
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
      case 'revision_required': return <AlertCircle className="w-3 h-3" />;
      default: return <Clock className="w-3 h-3" />;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'peer_reviewer': return 'Peer Reviewer';
      case 'subject_expert': return 'Subject Expert';
      case 'moderator': return 'Moderator';
      case 'admin': return 'Admin';
      default: return role;
    }
  };

  const getDecisionColor = (decision: string) => {
    switch (decision) {
      case 'approve': return 'bg-green-600 hover:bg-green-700';
      case 'reject': return 'bg-red-600 hover:bg-red-700';
      case 'request_revision': return 'bg-amber-600 hover:bg-amber-700';
      default: return 'bg-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Reviewer Dashboard</h1>
          <p className="text-gray-600">Review items, submit feedback, and track workflow progress</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Your Role</label>
            <select
              value={userRole}
              onChange={(e) => setUserRole(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="peer_reviewer">Peer Reviewer</option>
              <option value="subject_expert">Subject Expert</option>
              <option value="moderator">Moderator</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">User ID</label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-24 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Status Filter</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="peer_approved">Peer Approved</option>
              <option value="expert_approved">Expert Approved</option>
              <option value="revision_required">Revision Required</option>
            </select>
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
              {items.length} items for <strong>{getRoleLabel(userRole)}</strong>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-4 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col max-h-[calc(100vh-280px)]">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-gray-600" />
              <span className="font-semibold text-gray-800">Items for Review</span>
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
                        {item.parser_confidence && (
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${item.parser_confidence === 'green' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            {item.parser_confidence}
                          </span>
                        )}
                      </div>
                      {item.review_counts && Object.keys(item.review_counts).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {Object.entries(item.review_counts).map(([role, count]) => (
                            <span key={role} className="bg-gray-100 px-2 py-0.5 rounded text-xs text-gray-600 flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" />
                              {role}: {count}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                      <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                      <p>No items assigned for review</p>
                      <p className="text-xs mt-1">Check your role and subject assignments</p>
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
                        <div className="flex justify-between"><span className="text-gray-600">Last Used:</span> <span className="font-medium">{selectedItem.last_used_date || 'N/A'}</span></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="flex border-b border-gray-200">
                    <button
                      onClick={() => setActiveTab('review')}
                      className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'review' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
                    >
                      <span className="flex items-center gap-2"><Send className="w-4 h-4" /> Submit Review</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('threads')}
                      className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'threads' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
                    >
                      <span className="flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Review Threads ({Object.values(reviewThreads).flat().length})</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('history')}
                      className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'history' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
                    >
                      <span className="flex items-center gap-2"><History className="w-4 h-4" /> Workflow History ({workflowHistory.length})</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('qp_memo')}
                      className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'qp_memo' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
                    >
                      <span className="flex items-center gap-2"><FileText className="w-4 h-4" /> QP & Memo</span>
                    </button>
                  </div>

                  <div className="p-6">
                    {activeTab === 'review' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Review Type</label>
                            <select
                              value={reviewForm.review_type}
                              onChange={(e) => setReviewForm({...reviewForm, review_type: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="general">General Review</option>
                              <option value="technical">Technical Accuracy</option>
                              <option value="language">Language & Grammar</option>
                              <option value="marking">Marking Scheme</option>
                              <option value="curriculum">Curriculum Alignment</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Decision</label>
                            <select
                              value={reviewForm.decision}
                              onChange={(e) => setReviewForm({...reviewForm, decision: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="approve">Approve</option>
                              <option value="reject">Reject</option>
                              <option value="request_revision">Request Revision</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Comment</label>
                          <textarea
                            value={reviewForm.comment}
                            onChange={(e) => setReviewForm({...reviewForm, comment: e.target.value})}
                            rows={4}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                            placeholder="Enter your review comments here..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Transition Reason (optional)</label>
                          <input
                            type="text"
                            value={reviewForm.transition_reason}
                            onChange={(e) => setReviewForm({...reviewForm, transition_reason: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Reason for status change..."
                          />
                        </div>
                        <button
                          onClick={handleSubmitReview}
                          className={`w-full py-2.5 px-4 rounded-lg text-white font-medium text-sm transition-all flex items-center justify-center gap-2 ${getDecisionColor(reviewForm.decision)}`}
                        >
                          <Send className="w-4 h-4" />
                          Submit {reviewForm.decision === 'approve' ? 'Approval' : reviewForm.decision === 'reject' ? 'Rejection' : 'Revision Request'}
                        </button>
                      </div>
                    )}

                    {activeTab === 'threads' && (
                      <div className="space-y-4">
                        {Object.keys(reviewThreads).length === 0 ? (
                          <div className="text-center py-8 text-gray-500">
                            <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                            <p>No review threads yet</p>
                          </div>
                        ) : (
                          Object.entries(reviewThreads).map(([role, comments]) => (
                            <div key={role} className="border border-gray-200 rounded-lg overflow-hidden">
                              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                                <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                  <User className="w-4 h-4" />
                                  {getRoleLabel(role)} ({comments.length})
                                </span>
                              </div>
                              <div className="divide-y divide-gray-100">
                                {comments.map((comment) => (
                                  <div key={comment.review_id} className="p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="font-medium text-sm text-gray-900">{comment.reviewer_name || 'Unknown'}</span>
                                      <span className="text-xs text-gray-500">{new Date(comment.created_at).toLocaleString()}</span>
                                      <span className={`text-xs px-2 py-0.5 rounded-full ${comment.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                        {comment.status}
                                      </span>
                                    </div>
                                    <div className="text-sm text-gray-700 mb-1">
                                      <span className="font-medium text-xs uppercase tracking-wider text-gray-500">{comment.review_type}</span>
                                    </div>
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
                          <div className="text-center py-8 text-gray-500">
                            <History className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                            <p>No workflow history</p>
                          </div>
                        ) : (
                          workflowHistory.map((entry) => (
                            <div key={entry.workflow_id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                              <div className="mt-0.5">
                                {entry.current_state === 'revision_required' ? (
                                  <XCircle className="w-5 h-5 text-red-500" />
                                ) : (
                                  <CheckCircle className="w-5 h-5 text-green-500" />
                                )}
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
                                {entry.transition_reason && (
                                  <p className="text-sm text-gray-600 mt-1">{entry.transition_reason}</p>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {activeTab === 'qp_memo' && (
                      <div className="space-y-4">
                        {qpMemoData ? (
                          <>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="border border-gray-200 rounded-lg overflow-hidden">
                                <div className="bg-blue-50 px-4 py-2 border-b border-gray-200 flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-blue-600" />
                                  <span className="text-sm font-semibold text-gray-700">Question Paper</span>
                                  <span className="ml-auto text-xs text-gray-500">Marks: {qpMemoData.qp_marks ?? 'N/A'}</span>
                                </div>
                                <div className="p-4">
                                  <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{qpMemoData.qp_text || 'No QP text available'}</div>
                                </div>
                              </div>
                              <div className="border border-gray-200 rounded-lg overflow-hidden">
                                <div className="bg-green-50 px-4 py-2 border-b border-gray-200 flex items-center gap-2">
                                  <BookMarked className="w-4 h-4 text-green-600" />
                                  <span className="text-sm font-semibold text-gray-700">Memo / Answer</span>
                                  <span className="ml-auto text-xs text-gray-500">Marks: {qpMemoData.memo_marks ?? 'N/A'}</span>
                                </div>
                                <div className="p-4">
                                  <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{qpMemoData.memo_text || 'No memo text available'}</div>
                                </div>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            <FileText className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                            <p>No QP & Memo data available</p>
                            <p className="text-xs mt-1">This item may not have associated QP/Memo content</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">Select an item to review</h3>
                <p className="text-gray-500">Click on an item from the list to view details and submit your review</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewerDashboard;

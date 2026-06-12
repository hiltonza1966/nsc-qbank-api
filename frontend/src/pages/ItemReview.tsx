import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { itemsApi } from '../services/api';

const ItemReview: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [comment, setComment] = useState('');
  const [reviewType, setReviewType] = useState('general');

  const { data: pendingItems } = useQuery({
    queryKey: ['pendingItems'],
    queryFn: itemsApi.pending
  });

  const { data: itemReviews } = useQuery({
    queryKey: ['reviews', selectedItem?.item_id],
    queryFn: () => itemsApi.getReviews(selectedItem.item_id),
    enabled: !!selectedItem
  });

  const { data: workflow } = useQuery({
    queryKey: ['workflow', selectedItem?.item_id],
    queryFn: () => itemsApi.getWorkflow(selectedItem.item_id),
    enabled: !!selectedItem
  });

  const addReviewMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => itemsApi.addReview(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', selectedItem?.item_id] });
      setComment('');
    }
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => itemsApi.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingItems'] });
      setSelectedItem(null);
    }
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => itemsApi.reject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingItems'] });
      setSelectedItem(null);
    }
  });

  const handleAddReview = () => {
    if (!selectedItem || !comment) return;
    addReviewMutation.mutate({
      id: selectedItem.item_id,
      data: { review_type: reviewType, comment, status: 'open' }
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-200',
      subject_specialist_review: 'bg-yellow-200',
      pending_review: 'bg-orange-200',
      revision_required: 'bg-red-200',
      peer_approved: 'bg-blue-200',
      expert_approved: 'bg-indigo-200',
      qa_review: 'bg-purple-200',
      approved: 'bg-green-200',
      published: 'bg-green-400',
      archived: 'bg-gray-400'
    };
    return colors[status] || 'bg-gray-200';
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Review Board</h2>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-4">Pending Items ({pendingItems?.count || 0})</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {pendingItems?.items?.map((item: any) => (
              <div
                key={item.item_id}
                onClick={() => setSelectedItem(item)}
                className={`p-3 rounded cursor-pointer border ${
                  selectedItem?.item_id === item.item_id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-sm">{item.item_code}</p>
                    <p className="text-xs text-gray-600">{item.subject_name} - {item.paper_code}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${getStatusColor(item.status)}`}>
                    {item.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.question_text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          {selectedItem ? (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold">{selectedItem.item_code}</h3>
                <p className="text-sm text-gray-600">Status: {selectedItem.status}</p>
                <p className="text-sm mt-2">{selectedItem.question_text}</p>
              </div>

              <div>
                <h4 className="font-medium text-sm mb-2">Workflow History</h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {workflow?.workflow?.map((w: any, idx: number) => (
                    <div key={idx} className="text-xs p-2 bg-gray-50 rounded">
                      <span className="font-medium">{w.previous_state} → {w.current_state}</span>
                      <span className="text-gray-500 ml-2">by {w.changed_by_name || w.changed_by_role}</span>
                      <span className="text-gray-400 ml-2">{new Date(w.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium text-sm mb-2">Reviews ({itemReviews?.count || 0})</h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {itemReviews?.reviews?.map((r: any) => (
                    <div key={r.review_id} className="text-xs p-2 bg-gray-50 rounded">
                      <span className="font-medium">{r.reviewer_role}</span>
                      <span className="text-gray-500 ml-2">{r.review_type}</span>
                      <p className="mt-1">{r.comment}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium text-sm mb-2">Add Review</h4>
                <select
                  value={reviewType}
                  onChange={(e) => setReviewType(e.target.value)}
                  className="w-full border rounded px-2 py-1 text-sm mb-2"
                >
                  <option value="general">General</option>
                  <option value="accuracy">Accuracy</option>
                  <option value="clarity">Clarity</option>
                  <option value="curriculum">Curriculum</option>
                  <option value="bias">Bias</option>
                  <option value="technical">Technical</option>
                  <option value="marking">Marking</option>
                </select>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full border rounded px-2 py-1 text-sm h-20 mb-2"
                  placeholder="Enter your review comment..."
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddReview}
                    className="bg-blue-600 text-white px-4 py-1 rounded text-sm hover:bg-blue-700"
                    disabled={addReviewMutation.isPending}
                  >
                    Add Comment
                  </button>
                  <button
                    onClick={() => approveMutation.mutate(selectedItem.item_id)}
                    className="bg-green-600 text-white px-4 py-1 rounded text-sm hover:bg-green-700"
                    disabled={approveMutation.isPending}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => rejectMutation.mutate(selectedItem.item_id)}
                    className="bg-red-600 text-white px-4 py-1 rounded text-sm hover:bg-red-700"
                    disabled={rejectMutation.isPending}
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">Select an item to review</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ItemReview;

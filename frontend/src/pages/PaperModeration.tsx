import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { papersApi } from '../services/api';

const PaperModeration: React.FC = () => {
  const { paperId } = useParams();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const [signature, setSignature] = useState('');

  const { data: paper } = useQuery({
    queryKey: ['paper', paperId],
    queryFn: () => papersApi.get(paperId!),
    enabled: !!paperId
  });

  const { data: workflow } = useQuery({
    queryKey: ['paperWorkflow', paperId],
    queryFn: () => papersApi.getWorkflow(paperId!),
    enabled: !!paperId
  });

  const { data: approvals } = useQuery({
    queryKey: ['paperApprovals', paperId],
    queryFn: () => papersApi.getApprovals(paperId!),
    enabled: !!paperId
  });

  const approveMutation = useMutation({
    mutationFn: () => papersApi.approve(paperId!, { comments: comment, signature, approval_stage: paper?.paper?.status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paper', paperId] });
      queryClient.invalidateQueries({ queryKey: ['paperWorkflow', paperId] });
      queryClient.invalidateQueries({ queryKey: ['paperApprovals', paperId] });
      setComment('');
      setSignature('');
    }
  });

  const rejectMutation = useMutation({
    mutationFn: () => papersApi.reject(paperId!, { comments: comment, signature }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paper', paperId] });
      setComment('');
      setSignature('');
    }
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-200',
      assembled: 'bg-yellow-200',
      internal_moderated: 'bg-orange-200',
      external_moderated: 'bg-blue-200',
      dbe_approval: 'bg-purple-200',
      print_ready: 'bg-green-200',
      published: 'bg-green-400',
      archived: 'bg-gray-400'
    };
    return colors[status] || 'bg-gray-200';
  };

  if (!paperId) return <div>Select a paper to moderate</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Paper Moderation</h2>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-semibold">{paper?.paper?.paper_title}</h3>
            <p className="text-gray-600">
              {paper?.paper?.subject_name} | Paper {paper?.paper?.paper_no} | {paper?.paper?.total_marks} marks
            </p>
          </div>
          <span className={`px-3 py-1 rounded ${getStatusColor(paper?.paper?.status)}`}>
            {paper?.paper?.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium mb-2">Paper Items</h4>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {paper?.items?.map((item: any, idx: number) => (
                <div key={idx} className="p-3 border rounded">
                  <div className="flex justify-between">
                    <span className="font-medium">Q{idx + 1} ({item.section_name || 'Section'})</span>
                    <span className="text-sm text-gray-600">{item.marks_allocated} marks</span>
                  </div>
                  <p className="text-sm mt-1">{item.question_text}</p>
                  <div className="flex gap-2 mt-2 text-xs text-gray-500">
                    <span>{item.cognitive_level}</span>
                    <span>{item.difficulty}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Approval History</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {approvals?.approvals?.map((a: any, idx: number) => (
                  <div key={idx} className="p-2 bg-gray-50 rounded text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium">{a.approval_stage}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${a.status === 'approved' ? 'bg-green-200' : 'bg-red-200'}`}>
                        {a.status}
                      </span>
                    </div>
                    <p className="text-gray-600">{a.approver_role}</p>
                    {a.comments && <p className="text-gray-500 mt-1">{a.comments}</p>}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">Workflow History</h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {workflow?.workflow?.map((w: any, idx: number) => (
                  <div key={idx} className="text-xs p-2 bg-gray-50 rounded">
                    <span className="font-medium">{w.previous_state} → {w.current_state}</span>
                    <span className="text-gray-500 ml-2">by {w.changed_by_role}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-2">Moderation Action</h4>

              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full border rounded px-3 py-2 h-20 mb-2"
                placeholder="Enter moderation comments..."
              />

              <input
                type="text"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                className="w-full border rounded px-3 py-2 mb-2"
                placeholder="Digital signature (name)"
              />

              <div className="flex gap-2">
                <button
                  onClick={() => approveMutation.mutate()}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                  disabled={approveMutation.isPending}
                >
                  {approveMutation.isPending ? 'Approving...' : 'Approve'}
                </button>
                <button
                  onClick={() => rejectMutation.mutate()}
                  className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                  disabled={rejectMutation.isPending}
                >
                  {rejectMutation.isPending ? 'Rejecting...' : 'Reject / Revise'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaperModeration;

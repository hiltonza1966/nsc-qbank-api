import React from 'react';

interface WorkflowStatusProps {
  status: 'draft' | 'pending_review' | 'revision_required' | 'peer_approved' | 'expert_approved' | 'moderated' | 'published' | 'archived';
}

const STATUS_CONFIG = {
  draft: { color: '#95a5a6', label: 'Draft', icon: '📝' },
  pending_review: { color: '#f39c12', label: 'Pending Review', icon: '⏳' },
  revision_required: { color: '#e74c3c', label: 'Revision Required', icon: '🔴' },
  peer_approved: { color: '#3498db', label: 'Peer Approved', icon: '👥' },
  expert_approved: { color: '#9b59b6', label: 'Expert Approved', icon: '⭐' },
  moderated: { color: '#2ecc71', label: 'Moderated', icon: '✅' },
  published: { color: '#27ae60', label: 'Published', icon: '📢' },
  archived: { color: '#7f8c8d', label: 'Archived', icon: '📦' }
};

const WorkflowStatus: React.FC<WorkflowStatusProps> = ({ status }) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft;

  return (
    <span className="workflow-status" style={{ backgroundColor: config.color + '20', borderColor: config.color, color: config.color }}>
      <span className="status-icon">{config.icon}</span>
      <span className="status-label">{config.label}</span>
    </span>
  );
};

export default WorkflowStatus;

import React, { useState } from 'react';

interface ReviewFormProps {
  itemId: number;
  reviewerId: number;
  reviewerRole: string;
  onSubmit: (review: any) => void;
}

const REVIEW_TYPES = [
  { value: 'accuracy', label: 'Accuracy' },
  { value: 'clarity', label: 'Clarity' },
  { value: 'curriculum', label: 'Curriculum' },
  { value: 'bias', label: 'Bias' },
  { value: 'technical', label: 'Technical' },
  { value: 'general', label: 'General' }
];

const API_BASE = 'http://localhost:4000';

const ReviewForm: React.FC<ReviewFormProps> = ({ itemId, reviewerId, reviewerRole, onSubmit }) => {
  const [comment, setComment] = useState('');
  const [reviewType, setReviewType] = useState('general');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;

    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/api/items/${itemId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewer_id: reviewerId,
          reviewer_role: reviewerRole,
          review_type: reviewType,
          comment: comment
        })
      });

      const data = await response.json();
      if (data.success) {
        onSubmit(data);
        setComment('');
      }
    } catch (e) {
      console.error('Review submission failed:', e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="review-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label>Review Type:</label>
        <select value={reviewType} onChange={(e) => setReviewType(e.target.value)}>
          {REVIEW_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label>Comment:</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Enter your review comment..."
          rows={4}
        />
      </div>
      <button type="submit" disabled={submitting || !comment.trim()}>
        {submitting ? 'Submitting...' : 'Submit Review'}
      </button>
    </form>
  );
};

export default ReviewForm;

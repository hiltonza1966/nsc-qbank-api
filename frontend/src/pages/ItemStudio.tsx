import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { itemsApi, lookupApi } from '../services/api';

const ItemStudio: React.FC = () => {
  const { itemId } = useParams();
  const queryClient = useQueryClient();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [papers, setPapers] = useState<any[]>([]);
  const [cognitiveLevels, setCognitiveLevels] = useState<any[]>([]);
  const [difficulties, setDifficulties] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    subject_official_code: '',
    subject_alpha_code: '',
    paper_no: 1,
    question_text: '',
    marks: 5,
    cognitive_level: '',
    difficulty: '',
    cognitive_level_id: 1,
    difficulty_id: 1,
    topic: '',
    caps_subtopic_id: null,
    caps_reference: '',
    source_year: '',
    source_paper_code: '',
    source_question_number: ''
  });

  // Load lookups
  useEffect(() => {
    lookupApi.getTable('lookup_subjects').then(r => setSubjects(r.data || []));
    lookupApi.getTable('lookup_papers').then(r => setPapers(r.data || []));
    lookupApi.getTable('lookup_cognitive_levels').then(r => setCognitiveLevels(r.data || []));
    lookupApi.getTable('lookup_difficulty_levels').then(r => setDifficulties(r.data || []));
  }, []);

  // Load existing item if editing
  const { data: existingItem } = useQuery({
    queryKey: ['item', itemId],
    queryFn: () => itemsApi.get(itemId!),
    enabled: !!itemId
  });

  useEffect(() => {
    if (existingItem?.item) {
      setFormData(prev => ({ ...prev, ...existingItem.item }));
    }
  }, [existingItem]);

  const createMutation = useMutation({
    mutationFn: itemsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      alert('Item created successfully');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => itemsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      alert('Item updated successfully');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (itemId) {
      updateMutation.mutate({ id: itemId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleSubjectChange = (code: string) => {
    const subject = subjects.find(s => s.subject_official_code === code);
    setFormData(prev => ({
      ...prev,
      subject_official_code: code,
      subject_alpha_code: subject?.subject_alpha_code || code
    }));
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-6">{itemId ? 'Edit Item' : 'Create New Item'}</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Subject *</label>
            <select
              value={formData.subject_official_code}
              onChange={(e) => handleSubjectChange(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            >
              <option value="">Select Subject</option>
              {subjects.map(s => (
                <option key={s.subject_official_code} value={s.subject_official_code}>
                  {s.subject_name} ({s.subject_official_code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Paper *</label>
            <select
              value={formData.paper_no}
              onChange={(e) => setFormData(prev => ({ ...prev, paper_no: Number(e.target.value) }))}
              className="w-full border rounded px-3 py-2"
              required
            >
              <option value="">Select Paper</option>
              {papers.map(p => (
                <option key={p.paper_id} value={p.paper_no}>
                  {p.paper_name} ({p.paper_code})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Marks *</label>
            <input
              type="number"
              value={formData.marks}
              onChange={(e) => setFormData(prev => ({ ...prev, marks: Number(e.target.value) }))}
              className="w-full border rounded px-3 py-2"
              min={1}
              max={100}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Cognitive Level</label>
            <select
              value={formData.cognitive_level}
              onChange={(e) => setFormData(prev => ({ ...prev, cognitive_level: e.target.value }))}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Select</option>
              {cognitiveLevels.map(c => (
                <option key={c.cognitive_level_id} value={c.cognitive_level_name}>
                  {c.cognitive_level_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Difficulty</label>
            <select
              value={formData.difficulty}
              onChange={(e) => setFormData(prev => ({ ...prev, difficulty: e.target.value }))}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Select</option>
              {difficulties.map(d => (
                <option key={d.difficulty_id} value={d.difficulty_name}>
                  {d.difficulty_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Question Text *</label>
          <textarea
            value={formData.question_text}
            onChange={(e) => setFormData(prev => ({ ...prev, question_text: e.target.value }))}
            className="w-full border rounded px-3 py-2 h-32"
            placeholder="Enter question text..."
            required
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Source Year</label>
            <input
              type="number"
              value={formData.source_year}
              onChange={(e) => setFormData(prev => ({ ...prev, source_year: e.target.value }))}
              className="w-full border rounded px-3 py-2"
              placeholder="2024"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Source Paper Code</label>
            <input
              type="text"
              value={formData.source_paper_code}
              onChange={(e) => setFormData(prev => ({ ...prev, source_paper_code: e.target.value }))}
              className="w-full border rounded px-3 py-2"
              placeholder="e.g., MATH_P1_2024"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Source Q Number</label>
            <input
              type="text"
              value={formData.source_question_number}
              onChange={(e) => setFormData(prev => ({ ...prev, source_question_number: e.target.value }))}
              className="w-full border rounded px-3 py-2"
              placeholder="e.g., 1.1"
            />
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {itemId ? 'Update Item' : 'Create Item'}
          </button>

          {itemId && (
            <button
              type="button"
              onClick={() => itemsApi.submit(itemId).then(() => alert('Submitted for review'))}
              className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700"
            >
              Submit for Review
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default ItemStudio;

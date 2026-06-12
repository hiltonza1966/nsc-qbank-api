import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { papersApi, templatesApi, lookupApi } from '../services/api';

const PaperBuilder: React.FC = () => {
  const { paperId } = useParams();
  const queryClient = useQueryClient();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [papers, setPapers] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    subject_official_code: '',
    subject_alpha_code: '',
    paper_no: 1,
    title: '',
    template_id: ''
  });

  useEffect(() => {
    lookupApi.getTable('lookup_subjects').then(r => setSubjects(r.data || []));
    lookupApi.getTable('lookup_papers').then(r => setPapers(r.data || []));
    templatesApi.list().then(r => setTemplates(r.templates || []));
  }, []);

  const { data: paperList } = useQuery({
    queryKey: ['papers'],
    queryFn: () => papersApi.list({ subject_official_code: formData.subject_official_code })
  });

  const { data: selectedPaper } = useQuery({
    queryKey: ['paper', paperId],
    queryFn: () => papersApi.get(paperId!),
    enabled: !!paperId
  });

  const generateMutation = useMutation({
    mutationFn: papersApi.generate,
    onSuccess: (data) => {
      alert(`Paper generated: ${data.paper_id}`);
      queryClient.invalidateQueries({ queryKey: ['papers'] });
    }
  });

  const validateMutation = useMutation({
    mutationFn: (id: string) => papersApi.validate(id),
    onSuccess: (data) => {
      alert(`Compliance: ${data.compliance_passed ? 'PASSED' : 'FAILED'}`);
    }
  });

  const handleGenerate = () => {
    if (!formData.subject_official_code || !formData.paper_no || !formData.title) {
      alert('Please fill all required fields');
      return;
    }
    generateMutation.mutate(formData);
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
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Paper Builder</h2>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-semibold mb-4">Generate New Paper</h3>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Subject *</label>
            <select
              value={formData.subject_official_code}
              onChange={(e) => handleSubjectChange(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Select Subject</option>
              {subjects.map(s => (
                <option key={s.subject_official_code} value={s.subject_official_code}>
                  {s.subject_name}
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
            >
              <option value="">Select Paper</option>
              {papers.map(p => (
                <option key={p.paper_id} value={p.paper_no}>
                  {p.paper_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Template</label>
            <select
              value={formData.template_id}
              onChange={(e) => setFormData(prev => ({ ...prev, template_id: e.target.value }))}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Auto-select</option>
              {templates.filter(t => t.subject_official_code === formData.subject_official_code && t.paper_no === formData.paper_no).map(t => (
                <option key={t.template_id} value={t.template_id}>
                  {t.template_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Paper Title *</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            className="w-full border rounded px-3 py-2"
            placeholder="e.g., Mathematics Paper 1 - June 2026"
          />
        </div>

        <button
          onClick={handleGenerate}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
          disabled={generateMutation.isPending}
        >
          {generateMutation.isPending ? 'Generating...' : 'Auto-Generate Paper'}
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-semibold mb-4">Generated Papers</h3>

        <div className="space-y-2">
          {paperList?.papers?.map((paper: any) => (
            <div key={paper.paper_id} className="flex justify-between items-center p-3 border rounded">
              <div>
                <p className="font-medium">{paper.paper_title}</p>
                <p className="text-sm text-gray-600">
                  {paper.subject_official_code} Paper {paper.paper_no} | {paper.total_marks} marks | {paper.status}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => validateMutation.mutate(paper.paper_id)}
                  className="bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600"
                >
                  Validate
                </button>
                <button
                  onClick={() => papersApi.submit(paper.paper_id)}
                  className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                >
                  Submit
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedPaper && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold mb-4">Paper Preview: {selectedPaper.paper?.paper_title}</h3>
          <div className="space-y-2">
            {selectedPaper.items?.map((item: any, idx: number) => (
              <div key={idx} className="p-3 border rounded">
                <div className="flex justify-between">
                  <span className="font-medium">Q{idx + 1}</span>
                  <span className="text-sm text-gray-600">{item.marks_allocated} marks</span>
                </div>
                <p className="text-sm mt-1">{item.question_text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PaperBuilder;

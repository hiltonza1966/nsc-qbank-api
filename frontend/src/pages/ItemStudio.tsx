import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { itemsApi, lookupApi } from '../services/api';
import { getToolsForSubject, ToolConfig } from '../config/subjectTools';
import VersionDiff from '../components/VersionDiff';
import MediaUploader from '../components/MediaUploader';

// Lazy load subject-specific tool components
const MathTools = lazy(() => import('../components/tools/MathTools'));
const ScienceTools = lazy(() => import('../components/tools/ScienceTools'));
const AccountingTools = lazy(() => import('../components/tools/AccountingTools'));
const LanguageTools = lazy(() => import('../components/tools/LanguageTools'));
const ITTools = lazy(() => import('../components/tools/ITTools'));
const GeographyHistoryTools = lazy(() => import('../components/tools/GeographyHistoryTools'));

const TOOL_COMPONENTS: Record<string, React.ComponentType<any>> = {
  MathTools,
  ScienceTools,
  AccountingTools,
  LanguageTools,
  ITTools,
  GeographyHistoryTools,
};

const ItemStudio: React.FC = () => {
  const { itemId } = useParams();
  const queryClient = useQueryClient();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [papers, setPapers] = useState<any[]>([]);
  const [cognitiveLevels, setCognitiveLevels] = useState<any[]>([]);
  const [difficulties, setDifficulties] = useState<any[]>([]);
  const [availableTools, setAvailableTools] = useState<ToolConfig[]>([]);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [showVersionDiff, setShowVersionDiff] = useState(false);
  const [showMediaUploader, setShowMediaUploader] = useState(false);
  const [insertedContent, setInsertedContent] = useState<Array<{type: string, content: string}>>([]);

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
    caps_subtopic_id: null as number | null,
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

  // Update available tools when subject changes
  useEffect(() => {
    if (formData.subject_official_code) {
      const tools = getToolsForSubject(formData.subject_official_code);
      setAvailableTools(tools);
      if (tools.length > 0 && !activeTool) {
        setActiveTool(tools[0].id);
      }
    } else {
      setAvailableTools([]);
      setActiveTool(null);
    }
  }, [formData.subject_official_code]);

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
    let fullQuestionText = formData.question_text;
    if (insertedContent.length > 0) {
      const attachments = insertedContent.map(c => '[' + c.type.toUpperCase() + '] ' + c.content).join(String.fromCharCode(10));
      fullQuestionText = fullQuestionText + String.fromCharCode(10) + String.fromCharCode(10) + '[ATTACHMENTS]' + String.fromCharCode(10) + attachments;
    }

    const submitData = { ...formData, question_text: fullQuestionText };

    if (itemId) {
      updateMutation.mutate({ id: itemId, data: submitData });
    } else {
      createMutation.mutate(submitData);
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

  const handleToolInsert = (content: string, type: string) => {
    setInsertedContent(prev => [...prev, { type, content }]);
    setFormData(prev => ({
      ...prev,
      question_text: prev.question_text + String.fromCharCode(10) + String.fromCharCode(10) + '[' + type.toUpperCase() + '] ' + content
    }));
  };

  const handleMediaInsert = (files: Array<{url: string, type: string, name: string}>) => {
    files.forEach(file => {
      setInsertedContent(prev => [...prev, { type: file.type, content: file.url }]);
    });
  };

  const renderToolComponent = () => {
    if (!activeTool) return null;
    const tool = availableTools.find(t => t.id === activeTool);
    if (!tool) return null;

    const Component = TOOL_COMPONENTS[tool.component];
    if (!Component) return null;

    return (
      <Suspense fallback={<div className="p-4 text-gray-500">Loading tool...</div>}>
        <Component onInsert={handleToolInsert} />
      </Suspense>
    );
  };

  const getSubjectCategory = (code: string) => {
    const mathSubjects = ['19331054', '19331064', '19331074'];
    const scienceSubjects = ['19331084', '19331094', '19331104', '19331114'];
    const accountingSubjects = ['19331124', '19331134', '19331144'];
    const languageSubjects = ['19321154', '19321164', '19321174', '19321184', '19321194', '19321204', '19321214', '19321224', '19321234', '19321244', '19321254'];
    const itSubjects = ['19331224', '19331234', '19331244'];
    const geoHistorySubjects = ['19331154', '19331164', '19331174', '19331184'];

    if (mathSubjects.includes(code)) return 'Mathematics';
    if (scienceSubjects.includes(code)) return 'Physical Sciences / Life Sciences';
    if (accountingSubjects.includes(code)) return 'Accounting / Economics / Business';
    if (languageSubjects.includes(code)) return 'Languages';
    if (itSubjects.includes(code)) return 'CAT / IT / Technical';
    if (geoHistorySubjects.includes(code)) return 'Geography / History / Social Sciences';
    return 'General';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">{itemId ? 'Edit Item' : 'Create New Item'}</h2>
        <div className="flex gap-2">
          {itemId && (
            <button
              onClick={() => setShowVersionDiff(true)}
              className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700"
            >
              Version History
            </button>
          )}
          <button
            onClick={() => setShowMediaUploader(true)}
            className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700"
          >
            Upload Media
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="col-span-2 space-y-4">
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-4">
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
                      {p.paper_name}
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
                className="w-full border rounded px-3 py-2 h-48 font-mono text-sm"
                placeholder="Enter question text... Use subject-specific tools on the right for equations, graphs, diagrams, etc."
                required
              />
            </div>

            {/* Inserted Content Preview */}
            {insertedContent.length > 0 && (
              <div className="bg-gray-50 rounded p-3">
                <p className="text-sm font-medium mb-2">Inserted Content:</p>
                <div className="space-y-1">
                  {insertedContent.map((item, idx) => (
                    <div key={idx} className="text-xs bg-white p-2 rounded border">
                      <span className="font-medium text-blue-600">[{item.type.toUpperCase()}]</span>
                      <span className="text-gray-600 ml-2 truncate">{item.content.substring(0, 100)}...</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

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

        {/* Subject-Specific Tools Panel */}
        <div className="space-y-4">
          {formData.subject_official_code && (
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">{getSubjectCategory(formData.subject_official_code) === 'Mathematics' ? '∑' : 
                  getSubjectCategory(formData.subject_official_code) === 'Physical Sciences / Life Sciences' ? '⚗️' :
                  getSubjectCategory(formData.subject_official_code) === 'Accounting / Economics / Business' ? '📊' :
                  getSubjectCategory(formData.subject_official_code) === 'Languages' ? '🎙️' :
                  getSubjectCategory(formData.subject_official_code) === 'CAT / IT / Technical' ? '💻' :
                  getSubjectCategory(formData.subject_official_code) === 'Geography / History / Social Sciences' ? '🗺️' : '📝'}</span>
                <h3 className="font-semibold">{getSubjectCategory(formData.subject_official_code)} Tools</h3>
              </div>

              {availableTools.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-1">
                    {availableTools.map(tool => (
                      <button
                        key={tool.id}
                        onClick={() => setActiveTool(activeTool === tool.id ? null : tool.id)}
                        className={`px-3 py-1 rounded text-sm ${
                          activeTool === tool.id 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        <span className="mr-1">{tool.icon}</span>
                        {tool.name}
                      </button>
                    ))}
                  </div>

                  {activeTool && (
                    <div className="mt-3">
                      {renderToolComponent()}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No specialized tools for this subject.</p>
              )}
            </div>
          )}

          {/* CAPS Metadata */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold mb-3">CAPS Metadata</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">CAPS Topic</label>
                <input
                  type="text"
                  value={formData.topic}
                  onChange={(e) => setFormData(prev => ({ ...prev, topic: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="e.g., Algebra"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">CAPS Subtopic ID</label>
                <input
                  type="number"
                  value={formData.caps_subtopic_id || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, caps_subtopic_id: e.target.value ? Number(e.target.value) : null }))}
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="Subtopic ID"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">CAPS Reference</label>
                <input
                  type="text"
                  value={formData.caps_reference}
                  onChange={(e) => setFormData(prev => ({ ...prev, caps_reference: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="e.g., 3.1.1"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showVersionDiff && itemId && (
        <VersionDiff
          itemId={itemId}
          onClose={() => setShowVersionDiff(false)}
        />
      )}

      {showMediaUploader && (
        <MediaUploader
          onClose={() => setShowMediaUploader(false)}
          onInsert={handleMediaInsert}
        />
      )}
    </div>
  );
};

export default ItemStudio;

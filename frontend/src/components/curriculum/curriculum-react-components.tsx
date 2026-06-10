/**
 * components/curriculum/CurriculumDashboard.tsx
 * =============================================
 * Main dashboard for curriculum coverage analysis
 */

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';

interface CoverageSummary {
  total_topics: number;
  well_covered: number;
  adequate: number;
  insufficient: number;
  no_items: number;
  coverage_percent: number;
}

interface TopicCoverage {
  topic_code: string;
  topic_name: string;
  strand: string;
  term: string;
  topic_weighting: number;
  item_count: number;
  published_item_count: number;
  coverage_status: 'NO_ITEMS' | 'INSUFFICIENT' | 'ADEQUATE' | 'WELL_COVERED';
  relative_coverage_percent: number;
}

export const CurriculumDashboard: React.FC = () => {
  const [selectedSubject, setSelectedSubject] = useState('LIFE_SC');
  const [selectedGrade, setSelectedGrade] = useState(12);

  const { data: coverageData, isLoading } = useQuery({
    queryKey: ['curriculum-coverage', selectedSubject, selectedGrade],
    queryFn: () => api.get(`/curriculum/coverage/${selectedSubject}/${selectedGrade}`).then(r => r.data)
  });

  const { data: gapsData } = useQuery({
    queryKey: ['curriculum-gaps', selectedSubject, selectedGrade],
    queryFn: () => api.get(`/curriculum/gaps/${selectedSubject}/${selectedGrade}`).then(r => r.data)
  });

  const summary: CoverageSummary = coverageData?.summary || {
    total_topics: 0, well_covered: 0, adequate: 0, insufficient: 0, no_items: 0, coverage_percent: 0
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'WELL_COVERED': return 'bg-green-100 text-green-800';
      case 'ADEQUATE': return 'bg-blue-100 text-blue-800';
      case 'INSUFFICIENT': return 'bg-yellow-100 text-yellow-800';
      case 'NO_ITEMS': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">CAPS Curriculum Coverage</h1>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <select 
          value={selectedSubject} 
          onChange={e => setSelectedSubject(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="LIFE_SC">Life Sciences</option>
          <option value="MATH">Mathematics</option>
          <option value="PHYS_SC">Physical Sciences</option>
        </select>

        <select 
          value={selectedGrade} 
          onChange={e => setSelectedGrade(Number(e.target.value))}
          className="border rounded px-3 py-2"
        >
          <option value={10}>Grade 10</option>
          <option value={11}>Grade 11</option>
          <option value={12}>Grade 12</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold">{summary.total_topics}</div>
          <div className="text-sm text-gray-600">Total Topics</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-green-700">{summary.well_covered}</div>
          <div className="text-sm text-green-600">Well Covered</div>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-blue-700">{summary.adequate}</div>
          <div className="text-sm text-blue-600">Adequate</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-yellow-700">{summary.insufficient}</div>
          <div className="text-sm text-yellow-600">Insufficient</div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-red-700">{summary.no_items}</div>
          <div className="text-sm text-red-600">No Items</div>
        </div>
      </div>

      {/* Coverage Progress */}
      <div className="mb-8">
        <div className="flex justify-between mb-2">
          <span className="font-semibold">Overall Coverage</span>
          <span className="font-semibold">{summary.coverage_percent}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-4">
          <div 
            className="bg-blue-600 h-4 rounded-full transition-all" 
            style={{ width: `${summary.coverage_percent}%` }}
          />
        </div>
      </div>

      {/* Gaps Alert */}
      {gapsData?.gap_count > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <strong>Curriculum Gaps Detected:</strong> {gapsData.gap_count} topics need more items.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Topics Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Topic</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Strand</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Term</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Weight</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Items</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Published</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Coverage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {coverageData?.coverage?.map((topic: TopicCoverage) => (
              <tr key={topic.topic_code} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{topic.topic_name}</div>
                  <div className="text-sm text-gray-500">{topic.topic_code}</div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{topic.strand}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{topic.term}</td>
                <td className="px-4 py-3 text-right text-sm text-gray-600">{topic.topic_weighting}%</td>
                <td className="px-4 py-3 text-right text-sm font-medium">{topic.item_count}</td>
                <td className="px-4 py-3 text-right text-sm text-green-600">{topic.published_item_count}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(topic.coverage_status)}`}>
                    {topic.coverage_status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-sm text-gray-600">
                  {topic.relative_coverage_percent}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/**
 * components/curriculum/CAPSMapper.tsx
 * ======================================
 * Component for mapping items to CAPS curriculum during review
 */

interface CAPSMapperProps {
  itemId: string;
  currentMapping?: {
    topic_id: number;
    subtopic_id?: number;
    cognitive_level?: string;
    assessment_verb?: string;
  };
  onMappingChange: (mapping: any) => void;
}

export const CAPSMapper: React.FC<CAPSMapperProps> = ({ itemId, currentMapping, onMappingChange }) => {
  const [selectedTopic, setSelectedTopic] = useState(currentMapping?.topic_id || '');
  const [selectedSubtopic, setSelectedSubtopic] = useState(currentMapping?.subtopic_id || '');
  const [cognitiveLevel, setCognitiveLevel] = useState(currentMapping?.cognitive_level || '');
  const [assessmentVerb, setAssessmentVerb] = useState(currentMapping?.assessment_verb || '');

  const { data: topics } = useQuery({
    queryKey: ['caps-topics', 'LIFE_SC'],
    queryFn: () => api.get('/curriculum/subjects/LIFE_SC/topics').then(r => r.data)
  });

  const { data: subtopics } = useQuery({
    queryKey: ['caps-subtopics', selectedTopic],
    queryFn: () => selectedTopic ? api.get(`/curriculum/topics/${selectedTopic}/subtopics`).then(r => r.data) : Promise.resolve({ subtopics: [] }),
    enabled: !!selectedTopic
  });

  const handleSave = async () => {
    await api.post(`/curriculum/items/${itemId}/map`, {
      topic_id: selectedTopic,
      subtopic_id: selectedSubtopic || null,
      cognitive_level: cognitiveLevel,
      assessment_verb: assessmentVerb,
      is_primary: true
    });
    onMappingChange({ topic_id: selectedTopic, subtopic_id: selectedSubtopic, cognitive_level: cognitiveLevel, assessment_verb: assessmentVerb });
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="font-semibold mb-4">CAPS Curriculum Mapping</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">CAPS Topic</label>
          <select 
            value={selectedTopic} 
            onChange={e => setSelectedTopic(e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            <option value="">Select Topic...</option>
            {topics?.topics?.map((topic: any) => (
              <option key={topic.topic_id} value={topic.topic_id}>
                {topic.topic_code} - {topic.topic_name} (Grade {topic.grade_id})
              </option>
            ))}
          </select>
        </div>

        {selectedTopic && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subtopic</label>
            <select 
              value={selectedSubtopic} 
              onChange={e => setSelectedSubtopic(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Select Subtopic...</option>
              {subtopics?.subtopics?.map((sub: any) => (
                <option key={sub.subtopic_id} value={sub.subtopic_id}>
                  {sub.subtopic_code} - {sub.subtopic_name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cognitive Level</label>
          <select 
            value={cognitiveLevel} 
            onChange={e => setCognitiveLevel(e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            <option value="">Select Level...</option>
            <option value="remember">Remember (40%)</option>
            <option value="understand">Understand (25%)</option>
            <option value="apply">Apply (20%)</option>
            <option value="analyse">Analyse (15%)</option>
            <option value="evaluate">Evaluate</option>
            <option value="create">Create</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Assessment Verb</label>
          <input 
            type="text" 
            value={assessmentVerb}
            onChange={e => setAssessmentVerb(e.target.value)}
            placeholder="e.g., analyse, evaluate, compare"
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <button 
          onClick={handleSave}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          Save CAPS Mapping
        </button>
      </div>
    </div>
  );
};

/**
 * components/curriculum/PaperAssemblyCurriculum.tsx
 * ==================================================
 * Paper assembly with curriculum constraint enforcement
 */

interface CurriculumConstraint {
  topic_id: number;
  topic_name: string;
  min_items: number;
  max_items: number;
  min_marks: number;
  max_marks: number;
  cognitive_level?: string;
  is_mandatory: boolean;
}

export const PaperAssemblyCurriculum: React.FC = () => {
  const [templateId, setTemplateId] = useState('');
  const [constraints, setConstraints] = useState<CurriculumConstraint[]>([]);
  const [assembledPaper, setAssembledPaper] = useState<any>(null);

  const { data: templates } = useQuery({
    queryKey: ['paper-templates'],
    queryFn: () => api.get('/templates').then(r => r.data)
  });

  const { data: topics } = useQuery({
    queryKey: ['caps-topics', 'LIFE_SC', 12],
    queryFn: () => api.get('/curriculum/subjects/LIFE_SC/grades/12/topics').then(r => r.data)
  });

  const handleAssemble = async () => {
    const response = await api.post('/curriculum/assemble-by-caps', {
      template_id: templateId,
      subject_code: 'LIFE_SC',
      grade_id: 12,
      paper_id: 1,
      assessment_type_id: 1,
      assessment_body_id: 1,
      year_id: 6,
      constraints: constraints.map(c => ({
        topic_id: c.topic_id,
        min_items: c.min_items,
        max_items: c.max_items,
        min_marks: c.min_marks,
        max_marks: c.max_marks,
        cognitive_level: c.cognitive_level
      })),
      total_marks: 150
    });

    setAssembledPaper(response.data);
  };

  const addConstraint = (topicId: number, topicName: string) => {
    setConstraints([...constraints, {
      topic_id: topicId,
      topic_name: topicName,
      min_items: 1,
      max_items: 5,
      min_marks: 0,
      max_marks: 50,
      is_mandatory: true
    }]);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Curriculum-Based Paper Assembly</h1>

      {/* Template Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Paper Template</label>
        <select 
          value={templateId} 
          onChange={e => setTemplateId(e.target.value)}
          className="border rounded px-3 py-2 w-full max-w-md"
        >
          <option value="">Select Template...</option>
          {templates?.templates?.map((t: any) => (
            <option key={t.template_id} value={t.template_id}>
              {t.template_name} ({t.total_marks} marks, {t.total_items} items)
            </option>
          ))}
        </select>
      </div>

      {/* Curriculum Constraints */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-4">Curriculum Constraints</h2>

        {/* Available Topics */}
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Add Topic Constraint:</h3>
          <div className="flex flex-wrap gap-2">
            {topics?.topics?.map((topic: any) => (
              <button
                key={topic.topic_id}
                onClick={() => addConstraint(topic.topic_id, topic.topic_name)}
                disabled={constraints.some(c => c.topic_id === topic.topic_id)}
                className="px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-50"
              >
                + {topic.topic_code}
              </button>
            ))}
          </div>
        </div>

        {/* Active Constraints */}
        {constraints.length > 0 && (
          <div className="space-y-3">
            {constraints.map((constraint, index) => (
              <div key={index} className="bg-gray-50 p-4 rounded-lg flex items-center gap-4">
                <div className="flex-1">
                  <div className="font-medium">{constraint.topic_name}</div>
                  <div className="text-sm text-gray-500">
                    Items: {constraint.min_items}-{constraint.max_items} | 
                    Marks: {constraint.min_marks}-{constraint.max_marks}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm">Cognitive Level:</label>
                  <select 
                    value={constraint.cognitive_level || ''}
                    onChange={e => {
                      const newConstraints = [...constraints];
                      newConstraints[index].cognitive_level = e.target.value;
                      setConstraints(newConstraints);
                    }}
                    className="border rounded px-2 py-1 text-sm"
                  >
                    <option value="">Any</option>
                    <option value="remember">Remember</option>
                    <option value="understand">Understand</option>
                    <option value="apply">Apply</option>
                    <option value="analyse">Analyse</option>
                  </select>
                </div>
                <button 
                  onClick={() => setConstraints(constraints.filter((_, i) => i !== index))}
                  className="text-red-600 hover:text-red-800"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assemble Button */}
      <button 
        onClick={handleAssemble}
        disabled={!templateId || constraints.length === 0}
        className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50"
      >
        Assemble Paper from Curriculum
      </button>

      {/* Results */}
      {assembledPaper && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">
            Assembled Paper: {assembledPaper.total_items} items, {assembledPaper.total_marks} marks
          </h2>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">Item Code</th>
                  <th className="px-4 py-3 text-left">Question</th>
                  <th className="px-4 py-3 text-right">Marks</th>
                  <th className="px-4 py-3 text-left">Cognitive Level</th>
                  <th className="px-4 py-3 text-left">Difficulty</th>
                  <th className="px-4 py-3 text-right">Exposure</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {assembledPaper.items?.map((item: any, index: number) => (
                  <tr key={item.item_id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 font-mono text-sm">{item.item_code}</td>
                    <td className="px-4 py-3 text-sm">{item.question_preview || item.question_number}</td>
                    <td className="px-4 py-3 text-right font-medium">{item.marks}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs">
                        {item.cognitive_level}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{item.difficulty_level}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-500">
                      {item.exposure_count}x
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Coverage Summary */}
          <div className="mt-6 grid grid-cols-3 gap-4">
            {Object.entries(assembledPaper.coverage || {}).map(([topicId, count]) => {
              const topic = topics?.topics?.find((t: any) => t.topic_id === Number(topicId));
              return (
                <div key={topicId} className="bg-blue-50 p-3 rounded">
                  <div className="text-sm font-medium">{topic?.topic_code || topicId}</div>
                  <div className="text-2xl font-bold">{count as number} items</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * components/curriculum/CAPSSeeder.tsx
 * ====================================
 * Admin component for seeding CAPS data from PDF
 */

export const CAPSSeeder: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [seeded, setSeeded] = useState(false);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);

    const formData = new FormData();
    formData.append('capsPdf', file);

    try {
      const response = await api.post('/admin/caps/extract', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setPreview(response.data);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSeed = async () => {
    if (!preview) return;

    try {
      await api.post('/admin/caps/seed', {
        subjectCode: preview.subjectCode,
        confirm: 'SEED_CAPS_DATA'
      });
      setSeeded(true);
    } catch (error) {
      console.error('Seeding failed:', error);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">CAPS Curriculum Seeder</h1>

      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload CAPS PDF Document
          </label>
          <input 
            type="file" 
            accept=".pdf" 
            onChange={e => setFile(e.target.files?.[0] || null)}
            className="w-full border rounded px-3 py-2"
          />
          <p className="text-sm text-gray-500 mt-1">
            Upload the official DBE CAPS document (e.g., CAPS FET Life Sciences Grades 10-12)
          </p>
        </div>

        <button 
          onClick={handleUpload}
          disabled={!file || loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Extracting...' : 'Preview Curriculum Data'}
        </button>
      </div>

      {preview && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">
            Preview: {preview.subject} ({preview.topicCount} topics)
          </h2>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">Code</th>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Grade</th>
                  <th className="px-4 py-3 text-left">Term</th>
                  <th className="px-4 py-3 text-left">Strand</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {preview.topics?.map((topic: any) => (
                  <tr key={topic.code}>
                    <td className="px-4 py-3 font-mono text-sm">{topic.code}</td>
                    <td className="px-4 py-3">{topic.name}</td>
                    <td className="px-4 py-3">{topic.grade}</td>
                    <td className="px-4 py-3">{topic.term}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{topic.strand}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex gap-4">
            <button 
              onClick={handleSeed}
              disabled={seeded}
              className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50"
            >
              {seeded ? '✅ Seeded Successfully' : 'Seed to Database'}
            </button>

            <button 
              onClick={() => {
                const blob = new Blob([preview.sql], { type: 'text/sql' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `seed_${preview.subjectCode.toLowerCase()}.sql`;
                a.click();
              }}
              className="bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-700"
            >
              Download SQL
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

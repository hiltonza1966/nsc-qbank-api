import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';

// Types
interface CoverageData {
  topic_id: number;
  topic_name: string;
  coverage_percent: number;
  question_count: number;
  total_marks: number;
}

interface GapData {
  topic_id: number;
  topic_name: string;
  gap_type: string;
  severity: 'low' | 'medium' | 'high';
  recommended_action: string;
}

interface Template {
  template_id: number;
  template_name: string;
  subject_official_code: string;
  grade_id: number;
}

interface CAPSTopic {
  topic_id: number;
  topic_code: string;
  topic_name: string;
}

interface CAPSSubtopic {
  subtopic_id: number;
  subtopic_code: string;
  subtopic_name: string;
}

// Coverage Analysis Component
export const CoverageAnalysis: React.FC<{ selectedSubject: string; selectedGrade: number }> = ({ 
  selectedSubject, 
  selectedGrade 
}) => {
  const { data: coverageData } = useQuery({
    queryKey: ['coverage', selectedSubject, selectedGrade],
    enabled: !!selectedSubject && !!selectedGrade,
    queryFn: () => api.get(`/curriculum/coverage/${selectedSubject}/${selectedGrade}`).then((r: any) => r.data)
  });

  const coverage: CoverageData[] = coverageData?.coverage || [];

  return (
    <div className="coverage-analysis">
      <h3>Topic Coverage Analysis</h3>
      <table>
        <thead>
          <tr>
            <th>Topic</th>
            <th>Coverage %</th>
            <th>Questions</th>
            <th>Marks</th>
          </tr>
        </thead>
        <tbody>
          {coverage.map((item: CoverageData) => (
            <tr key={item.topic_id}>
              <td>{item.topic_name}</td>
              <td>{item.coverage_percent}%</td>
              <td>{item.question_count}</td>
              <td>{item.total_marks}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Gap Analysis Component
export const GapAnalysis: React.FC<{ selectedSubject: string; selectedGrade: number }> = ({ 
  selectedSubject, 
  selectedGrade 
}) => {
  const { data: gapsData } = useQuery({
    queryKey: ['gaps', selectedSubject, selectedGrade],
    enabled: !!selectedSubject && !!selectedGrade,
    queryFn: () => api.get(`/curriculum/gaps/${selectedSubject}/${selectedGrade}`).then((r: any) => r.data)
  });

  const gaps: GapData[] = gapsData?.gaps || [];

  return (
    <div className="gap-analysis">
      <h3>Curriculum Gap Analysis</h3>
      {gaps.length === 0 ? (
        <p>No gaps detected. Coverage is complete.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Topic</th>
              <th>Gap Type</th>
              <th>Severity</th>
              <th>Recommended Action</th>
            </tr>
          </thead>
          <tbody>
            {gaps.map((gap: GapData, index: number) => (
              <tr key={index} className={`severity-${gap.severity}`}>
                <td>{gap.topic_name}</td>
                <td>{gap.gap_type}</td>
                <td>{gap.severity}</td>
                <td>{gap.recommended_action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

// Template Selector Component
export const TemplateSelector: React.FC<{ onSelect: (template: Template) => void }> = ({ onSelect }) => {
  const { data: templatesData } = useQuery({
    queryKey: ['templates'],
    queryFn: () => api.get('/templates').then((r: any) => r.data)
  });

  const templates: Template[] = templatesData?.templates || [];

  return (
    <div className="template-selector">
      <h3>Select Paper Template</h3>
      <select onChange={(e) => {
        const template = templates.find((t: Template) => t.template_id === Number(e.target.value));
        if (template) onSelect(template);
      }}>
        <option value="">Select Template</option>
        {templates.map((template: Template) => (
          <option key={template.template_id} value={template.template_id}>
            {template.template_name} (Grade {template.grade_id})
          </option>
        ))}
      </select>
    </div>
  );
};

// Topic Browser Component
export const TopicBrowser: React.FC = () => {
  const [selectedTopic, setSelectedTopic] = useState<number | ''>('');

  const { data: topicsData } = useQuery({
    queryKey: ['caps-topics', 'LIFE_SC'],
    queryFn: () => api.get('/curriculum/subjects/LIFE_SC/topics').then((r: any) => r.data)
  });

  const { data: subtopicsData } = useQuery({
    queryKey: ['caps-subtopics', selectedTopic],
    enabled: !!selectedTopic,
    queryFn: () => selectedTopic 
      ? api.get(`/curriculum/topics/${selectedTopic}/subtopics`).then((r: any) => r.data)
      : Promise.resolve({ subtopics: [] })
  });

  const topics: CAPSTopic[] = topicsData?.topics || [];
  const subtopics: CAPSSubtopic[] = subtopicsData?.subtopics || [];

  return (
    <div className="topic-browser">
      <h3>CAPS Topics</h3>
      <select 
        value={selectedTopic} 
        onChange={(e) => setSelectedTopic(e.target.value ? Number(e.target.value) : '')}
      >
        <option value="">Select Topic</option>
        {topics.map((topic: CAPSTopic) => (
          <option key={topic.topic_id} value={topic.topic_id}>
            {topic.topic_code} - {topic.topic_name}
          </option>
        ))}
      </select>

      {selectedTopic && subtopics.length > 0 && (
        <div className="subtopics">
          <h4>Subtopics</h4>
          <ul>
            {subtopics.map((sub: CAPSSubtopic) => (
              <li key={sub.subtopic_id}>
                {sub.subtopic_code} - {sub.subtopic_name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// Grade 12 Topic Selector
export const Grade12TopicSelector: React.FC<{ onSelect: (topicId: number) => void }> = ({ onSelect }) => {
  const { data: topicsData } = useQuery({
    queryKey: ['caps-topics', 'LIFE_SC', 12],
    queryFn: () => api.get('/curriculum/subjects/LIFE_SC/grades/12/topics').then((r: any) => r.data)
  });

  const topics: CAPSTopic[] = topicsData?.topics || [];

  return (
    <div className="grade-12-topics">
      <h3>Grade 12 Topics</h3>
      <select onChange={(e) => onSelect(Number(e.target.value))}>
        <option value="">Select Topic</option>
        {topics.map((topic: CAPSTopic) => (
          <option key={topic.topic_id} value={topic.topic_id}>
            {topic.topic_code} - {topic.topic_name}
          </option>
        ))}
      </select>
    </div>
  );
};

import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';

// Types
interface Paper {
  paper_id: number;
  paper_code: string;
  paper_name: string;
  subject_official_code: string;
  grade_id: number;
}

interface UnlinkedItem {
  item_id: number;
  question_number: string;
  question_text: string;
  marks: number;
  topic_id: number | null;
  subtopic_id: number | null;
}

interface SubjectOption {
  subject_official_code: string;
  subject_alpha_code: string;
  subject_name: string;
}

interface CAPSTopic {
  topic_id: number;
  topic_code: string;
  topic_name: string;
  grade_id: number;
}

interface CAPSSubtopic {
  subtopic_id: number;
  subtopic_code: string;
  subtopic_name: string;
  topic_id: number;
}

interface LinkRecord {
  item_id: number;
  topic_id: number;
  subtopic_id: number | null;
}

const CAPSManualLinker: React.FC = () => {
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedPaper, setSelectedPaper] = useState<number | ''>('');
  const [selectedTopic, setSelectedTopic] = useState<number | ''>('');
  const [selectedSubtopic, setSelectedSubtopic] = useState<number | ''>('');
  const [globalTopic, setGlobalTopic] = useState<CAPSTopic | null>(null);
  const [links, setLinks] = useState<LinkRecord[]>([]);
  const queryClient = useQueryClient();

  // Fetch subjects from caps_subjects_master
  const { data: subjectsData } = useQuery({
    queryKey: ['caps-subjects'],
    queryFn: () => api.get('/api/caps/subjects').then((r: any) => r.data)
  });

  // Fetch papers with unlinked items
  const { data: papersData } = useQuery({
    queryKey: ['papers-unlinked'],
    queryFn: () => api.get('/curriculum/papers-with-unlinked').then((r: any) => r.data)
  });

  // Fetch unlinked items for selected paper
  const { data: unlinkedItemsData } = useQuery({
    queryKey: ['unlinked-items', selectedPaper],
    enabled: !!selectedPaper,
    queryFn: () => api.get(`/curriculum/unlinked/${selectedPaper}`).then((r: any) => r.data)
  });

  // Fetch CAPS topics for selected subject (dynamic instead of hardcoded LIFE_SC)
  const { data: topicsData } = useQuery({
    queryKey: ['caps-topics', selectedSubject],
    enabled: !!selectedSubject,
    queryFn: () => selectedSubject
      ? api.get(`/curriculum/subjects/${selectedSubject}/topics`).then((r: any) => r.data)
      : Promise.resolve({ topics: [] })
  });

  // Fetch subtopics for selected topic
  const { data: subtopicsData } = useQuery({
    queryKey: ['caps-subtopics', selectedTopic],
    enabled: !!selectedTopic,
    queryFn: () => selectedTopic
      ? api.get(`/curriculum/topics/${selectedTopic}/subtopics`).then((r: any) => r.data)
      : Promise.resolve({ subtopics: [] })
  });

  // Fetch items for global topic
  const { data: topicItemsData } = useQuery({
    queryKey: ['topic-items', globalTopic?.topic_id],
    enabled: !!globalTopic,
    queryFn: () => api.get(`/curriculum/topics/${globalTopic?.topic_id}/items`).then((r: any) => r.data)
  });

  // Bulk link mutation
  const linkMutation = useMutation({
    mutationFn: (links: LinkRecord[]) => api.post('/curriculum/bulk-link', { links }).then((r: any) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unlinked-items'] });
      queryClient.invalidateQueries({ queryKey: ['papers-unlinked'] });
      setLinks([]);
      alert('Links saved successfully!');
    }
  });

  const subjects: SubjectOption[] = subjectsData?.subjects || [];
  const papers: Paper[] = papersData?.papers || [];
  const unlinkedItems: UnlinkedItem[] = unlinkedItemsData?.items || [];
  const topics: CAPSTopic[] = topicsData?.topics || [];
  const subtopics: CAPSSubtopic[] = subtopicsData?.subtopics || [];
  const topicItems = topicItemsData?.items || [];

  const handleLink = useCallback((itemId: number, _questionNumber: string) => {
    if (!selectedTopic) {
      alert('Please select a topic first');
      return;
    }

    const existing = links.find(l => l.item_id === itemId);
    if (existing) {
      setLinks(prev => prev.filter(l => l.item_id !== itemId));
    } else {
      setLinks(prev => [...prev, {
        item_id: itemId,
        topic_id: Number(selectedTopic),
        subtopic_id: selectedSubtopic ? Number(selectedSubtopic) : null
      }]);
    }
  }, [selectedTopic, selectedSubtopic, links]);

  const handleSave = useCallback(() => {
    if (links.length === 0) {
      alert('No links to save');
      return;
    }
    linkMutation.mutate(links);
  }, [links, linkMutation]);

  const handleGlobalTopicSelect = useCallback((topicId: number) => {
    const topic = topics.find(t => t.topic_id === topicId);
    if (topic) {
      setGlobalTopic(topic);
      setSelectedTopic(topicId);
    }
  }, [topics]);

  return (
    <div className="caps-manual-linker">
      <h2>CAPS Manual Linker</h2>

      <div className="linker-controls">
        <div className="control-group">
          <label>Subject:</label>
          <select
            value={selectedSubject}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedSubject(val);
              setSelectedTopic('');
              setSelectedSubtopic('');
              setGlobalTopic(null);
            }}
          >
            <option value="">Select Subject</option>
            {subjects.map((subject: SubjectOption) => (
              <option key={subject.subject_official_code} value={subject.subject_official_code}>
                {subject.subject_name} ({subject.subject_official_code})
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label>Paper:</label>
          <select
            value={selectedPaper}
            onChange={(e) => setSelectedPaper(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">Select Paper</option>
            {papers.map((paper: Paper) => (
              <option key={paper.paper_id} value={paper.paper_id}>
                {paper.paper_code} - {paper.paper_name}
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label>Topic:</label>
          <select
            value={selectedTopic}
            onChange={(e) => {
              const val = e.target.value ? Number(e.target.value) : '';
              setSelectedTopic(val);
              setSelectedSubtopic('');
              if (val) handleGlobalTopicSelect(Number(val));
            }}
          >
            <option value="">Select Topic</option>
            {topics.map((topic: CAPSTopic) => (
              <option key={topic.topic_id} value={topic.topic_id}>
                {topic.topic_code} - {topic.topic_name}
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label>Subtopic (optional):</label>
          <select
            value={selectedSubtopic}
            onChange={(e) => setSelectedSubtopic(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">Select Subtopic</option>
            {subtopics.map((sub: CAPSSubtopic) => (
              <option key={sub.subtopic_id} value={sub.subtopic_id}>
                {sub.subtopic_code} - {sub.subtopic_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedPaper && (
        <div className="unlinked-items">
          <h3>Unlinked Items ({unlinkedItems.length})</h3>
          <table>
            <thead>
              <tr>
                <th>Q#</th>
                <th>Question</th>
                <th>Marks</th>
                <th>Link</th>
              </tr>
            </thead>
            <tbody>
              {unlinkedItems.map((item: UnlinkedItem) => (
                <tr key={item.item_id}>
                  <td>{item.question_number}</td>
                  <td>{item.question_text?.substring(0, 100)}...</td>
                  <td>{item.marks}</td>
                  <td>
                    <button
                      onClick={() => handleLink(item.item_id, item.question_number)}
                      className={links.find(l => l.item_id === item.item_id) ? 'linked' : ''}
                    >
                      {links.find(l => l.item_id === item.item_id) ? '✓ Linked' : 'Link'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {globalTopic && (
        <div className="topic-items">
          <h3>Items in Topic: {globalTopic.topic_name}</h3>
          <p>{topicItems.length} items already linked to this topic</p>
        </div>
      )}

      <div className="linker-actions">
        <button
          onClick={handleSave}
          disabled={links.length === 0 || linkMutation.isPending}
          className="btn-primary"
        >
          {linkMutation.isPending ? 'Saving...' : `Save ${links.length} Links`}
        </button>
      </div>
    </div>
  );
};

export default CAPSManualLinker;

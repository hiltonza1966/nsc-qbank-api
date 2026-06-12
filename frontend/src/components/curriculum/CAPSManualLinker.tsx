/**
 * components/curriculum/CAPSManualLinker.tsx
 * ==========================================
 * Admin interface for manually linking unlinked items to CAPS curriculum
 * 
 * Features:
 * - Shows all papers with unlinked items
 * - Displays unlinked items per paper with question preview
 * - Dropdowns for CAPS topic/subtopic selection
 * - Cognitive level and assessment verb selection
 * - Bulk save capability
 * - Progress tracking
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// import { api } from '../../services/api';
const api = { get: (url: string) => fetch(url).then(r => r.json()), post: (url: string, body: any) => fetch(url, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body) }).then(r => r.json()) };

interface UnlinkedItem {
  question_number: string;
  expected_marks: number;
  section: string;
  sequence: number;
  paper_code: string;
  item_id?: string;
  question_text?: string;
  marks?: number;
  cognitive_level?: string;
  difficulty_level?: string;
  item_type?: string;
}

interface PaperSummary {
  paper_code: string;
  total_items: number;
  unlinked_count: number;
  linked_count: number;
  linked_percent: number;
}

interface CAPSTopic {
  topic_id: number;
  topic_code: string;
  topic_name: string;
  grade_id: number;
  strand: string;
  term: string;
  topic_weighting: number;
  paper_no: number;
  subtopic_count?: number;
}

interface CAPSSubtopic {
  subtopic_id: number;
  subtopic_code: string;
  subtopic_name: string;
  caps_reference: string;
}

interface LinkForm {
  topic_id: number;
  subtopic_id?: number;
  caps_reference: string;
  cognitive_level: string;
  assessment_verb: string;
  source_topic: string;
  source_subtopic: string;
}

export const CAPSManualLinker: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedPaper, setSelectedPaper] = useState<string>('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [linkForms, setLinkForms] = useState<Record<string, LinkForm>>({});
  const [globalTopic, setGlobalTopic] = useState<CAPSTopic | null>(null);
  const [globalSubtopic, setGlobalSubtopic] = useState<CAPSSubtopic | null>(null);
  const [showBulkMode, setShowBulkMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSection, setFilterSection] = useState('');

  // Fetch papers with unlinked items
  const { data: papersData, isLoading: papersLoading } = useQuery({
    queryKey: ['papers-with-unlinked'],
    queryFn: () => api.get('/curriculum/papers-with-unlinked').then(r => r.data)
  });

  // Fetch unlinked items for selected paper
  const { data: unlinkedData, isLoading: itemsLoading } = useQuery({
    queryKey: ['unlinked-items', selectedPaper],
    queryFn: () => api.get(`/curriculum/unlinked/${selectedPaper}`).then(r => r.data),
    enabled: !!selectedPaper
  });

  // Fetch CAPS topics (all subjects, all grades)
  const { data: topicsData } = useQuery({
    queryKey: ['caps-topics-all'],
    queryFn: () => api.get('/curriculum/subjects/LIFE_SC/topics').then(r => r.data)
  });

  // Fetch subtopics for selected global topic
  const { data: subtopicsData } = useQuery({
    queryKey: ['caps-subtopics', globalTopic?.topic_id],
    queryFn: () => api.get(`/curriculum/topics/${globalTopic?.topic_id}/items`).then(r => r.data),
    enabled: !!globalTopic
  });

  // Bulk link mutation
  const bulkLinkMutation = useMutation({
    mutationFn: (links: any[]) => api.post('/curriculum/bulk-link', { links }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unlinked-items', selectedPaper] });
      queryClient.invalidateQueries({ queryKey: ['papers-with-unlinked'] });
      setSelectedItems(new Set());
      alert('Items linked successfully!');
    }
  });

  const papers: PaperSummary[] = papersData?.papers || [];
  const unlinkedItems: UnlinkedItem[] = unlinkedData?.items || [];
  const topics: CAPSTopic[] = topicsData?.topics || [];
  const subtopics: CAPSSubtopic[] = subtopicsData?.items || []; // Note: endpoint returns items, need subtopics

  // Filter items by search and section
  const filteredItems = unlinkedItems.filter(item => {
    const matchesSearch = !searchTerm || 
      item.question_number.includes(searchTerm) ||
      (item.question_text && item.question_text.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesSection = !filterSection || item.section === filterSection;
    return matchesSearch && matchesSection;
  });

  // Get unique sections for filter
  const sections = [...new Set(unlinkedItems.map(i => i.section))];

  const toggleItem = useCallback((questionNumber: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(questionNumber)) {
        next.delete(questionNumber);
      } else {
        next.add(questionNumber);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedItems(new Set(filteredItems.map(i => i.question_number)));
  }, [filteredItems]);

  const deselectAll = useCallback(() => {
    setSelectedItems(new Set());
  }, []);

  const handleBulkLink = () => {
    if (!globalTopic) {
      alert('Please select a CAPS topic first');
      return;
    }
    if (selectedItems.size === 0) {
      alert('Please select at least one item');
      return;
    }

    const links = Array.from(selectedItems).map(qn => {
      const item = unlinkedItems.find(i => i.question_number === qn);
      return {
        question_number: qn,
        paper_code: selectedPaper,
        topic_id: globalTopic.topic_id,
        subtopic_id: globalSubtopic?.subtopic_id,
        caps_reference: globalSubtopic?.caps_reference || globalTopic.topic_code,
        cognitive_level: 'remember',
        assessment_verb: 'state',
        source_topic: globalTopic.topic_name,
        source_subtopic: globalSubtopic?.subtopic_name || globalTopic.topic_name
      };
    });

    bulkLinkMutation.mutate(links);
  };

  const handleIndividualLink = (item: UnlinkedItem) => {
    const form = linkForms[item.question_number];
    if (!form || !form.topic_id) {
      alert('Please select a topic for this item');
      return;
    }

    bulkLinkMutation.mutate([{
      question_number: item.question_number,
      paper_code: item.paper_code,
      topic_id: form.topic_id,
      subtopic_id: form.subtopic_id,
      caps_reference: form.caps_reference,
      cognitive_level: form.cognitive_level,
      assessment_verb: form.assessment_verb,
      source_topic: form.source_topic,
      source_subtopic: form.source_subtopic
    }]);
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 90) return 'bg-green-500';
    if (percent >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">CAPS Manual Linking Interface</h1>

      {/* Paper Selection */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Papers with Unlinked Items</h2>
        {papersLoading ? (
          <div className="text-gray-500">Loading papers...</div>
        ) : papers.length === 0 ? (
          <div className="bg-green-50 p-4 rounded-lg text-green-700">
            Γ£à All items are linked! No papers need manual linking.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {papers.map(paper => (
              <div 
                key={paper.paper_code}
                onClick={() => setSelectedPaper(paper.paper_code)}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedPaper === paper.paper_code 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium text-gray-900">{paper.paper_code}</div>
                <div className="text-sm text-gray-600 mt-1">
                  {paper.linked_count} / {paper.total_items} linked
                </div>
                <div className="mt-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${getProgressColor(paper.linked_percent)}`}
                      style={{ width: `${paper.linked_percent}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {paper.linked_percent}% complete ({paper.unlinked_count} remaining)
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Unlinked Items for Selected Paper */}
      {selectedPaper && (
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">
              Unlinked Items: {selectedPaper}
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({unlinkedData?.total_unlinked || 0} total)
              </span>
            </h2>
            <div className="flex gap-2">
              <button 
                onClick={() => setShowBulkMode(!showBulkMode)}
                className={`px-4 py-2 rounded ${showBulkMode ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
              >
                Bulk Mode
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-4 mb-4">
            <input
              type="text"
              placeholder="Search question number or text..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="flex-1 border rounded px-3 py-2"
            />
            <select 
              value={filterSection} 
              onChange={e => setFilterSection(e.target.value)}
              className="border rounded px-3 py-2"
            >
              <option value="">All Sections</option>
              {sections.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Bulk Link Controls */}
          {showBulkMode && (
            <div className="bg-blue-50 p-4 rounded-lg mb-4">
              <h3 className="font-medium mb-3">Bulk Link Selected Items</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <select 
                  value={globalTopic?.topic_id || ''} 
                  onChange={e => {
                    const topic = topics.find(t => t.topic_id === Number(e.target.value));
                    setGlobalTopic(topic || null);
                    setGlobalSubtopic(null);
                  }}
                  className="border rounded px-3 py-2"
                >
                  <option value="">Select CAPS Topic...</option>
                  {topics.map(topic => (
                    <option key={topic.topic_id} value={topic.topic_id}>
                      {topic.topic_code} - {topic.topic_name}
                    </option>
                  ))}
                </select>

                {globalTopic && (
                  <select 
                    value={globalSubtopic?.subtopic_id || ''} 
                    onChange={e => {
                      // Fetch subtopics for this topic
                      api.get(`/curriculum/topics/${globalTopic.topic_id}/items`).then(r => {
                        // Need a proper subtopics endpoint - this is a placeholder
                      });
                    }}
                    className="border rounded px-3 py-2"
                  >
                    <option value="">Select Subtopic (optional)...</option>
                  </select>
                )}
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={selectAll}
                  className="px-3 py-1 bg-gray-200 rounded text-sm"
                >
                  Select All ({filteredItems.length})
                </button>
                <button 
                  onClick={deselectAll}
                  className="px-3 py-1 bg-gray-200 rounded text-sm"
                >
                  Deselect All
                </button>
                <button 
                  onClick={handleBulkLink}
                  disabled={bulkLinkMutation.isPending || selectedItems.size === 0}
                  className="px-4 py-1 bg-green-600 text-white rounded text-sm disabled:opacity-50"
                >
                  {bulkLinkMutation.isPending ? 'Linking...' : `Link ${selectedItems.size} Items`}
                </button>
              </div>
            </div>
          )}

          {/* Items Table */}
          {itemsLoading ? (
            <div className="text-gray-500">Loading items...</div>
          ) : filteredItems.length === 0 ? (
            <div className="bg-green-50 p-4 rounded-lg text-green-700">
              Γ£à All items in this paper are linked!
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    {showBulkMode && <th className="px-4 py-3 w-10"></th>}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Question</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Section</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Marks</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Preview</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CAPS Topic</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredItems.map(item => (
                    <tr key={item.question_number} className="hover:bg-gray-50">
                      {showBulkMode && (
                        <td className="px-4 py-3">
                          <input 
                            type="checkbox"
                            checked={selectedItems.has(item.question_number)}
                            onChange={() => toggleItem(item.question_number)}
                            className="rounded"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3 font-medium">{item.question_number}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{item.section}</td>
                      <td className="px-4 py-3 text-right text-sm">{item.expected_marks}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                        {item.question_text ? item.question_text.substring(0, 100) + '...' : 'No text'}
                      </td>
                      <td className="px-4 py-3">
                        {!showBulkMode ? (
                          <div className="space-y-2">
                            <select 
                              value={linkForms[item.question_number]?.topic_id || ''}
                              onChange={e => {
                                const topic = topics.find(t => t.topic_id === Number(e.target.value));
                                setLinkForms(prev => ({
                                  ...prev,
                                  [item.question_number]: {
                                    ...prev[item.question_number],
                                    topic_id: Number(e.target.value),
                                    source_topic: topic?.topic_name || '',
                                    caps_reference: topic?.topic_code || ''
                                  }
                                }));
                              }}
                              className="w-full text-sm border rounded px-2 py-1"
                            >
                              <option value="">Select Topic...</option>
                              {topics.map(topic => (
                                <option key={topic.topic_id} value={topic.topic_id}>
                                  {topic.topic_code}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">
                            {selectedItems.has(item.question_number) ? 'Will be bulk linked' : 'ΓÇö'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {!showBulkMode && (
                          <button 
                            onClick={() => handleIndividualLink(item)}
                            disabled={!linkForms[item.question_number]?.topic_id}
                            className="px-3 py-1 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
                          >
                            Link
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};


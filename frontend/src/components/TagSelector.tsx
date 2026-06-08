import React, { useState, useEffect } from 'react';

interface Tag {
  id: number;
  tag_code: string;
  tag_name: string;
  tag_level: string;
  parent_tag_id?: number;
}

interface TagSelectorProps {
  level: string;
  parentId?: number;
  selectedTags: string[];
  onChange: (tags: string[]) => void;
}

const API_BASE = 'http://localhost:4000';

const TagSelector: React.FC<TagSelectorProps> = ({ level, parentId, selectedTags, onChange }) => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTags();
  }, [level, parentId]);

  const fetchTags = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ level });
      if (parentId) params.append('parent_id', parentId.toString());

      const response = await fetch(`${API_BASE}/api/taxonomy?${params}`);
      const data = await response.json();
      setTags(data.tags || []);
    } catch (e) {
      console.error('Failed to load tags:', e);
    } finally {
      setLoading(false);
    }
  };

  const toggleTag = (tagCode: string) => {
    if (selectedTags.includes(tagCode)) {
      onChange(selectedTags.filter(t => t !== tagCode));
    } else {
      onChange([...selectedTags, tagCode]);
    }
  };

  if (loading) return <div className="tag-loading">Loading tags...</div>;

  return (
    <div className="tag-selector">
      {tags.map(tag => (
        <button
          key={tag.tag_code}
          className={`tag-btn ${selectedTags.includes(tag.tag_code) ? 'selected' : ''}`}
          onClick={() => toggleTag(tag.tag_code)}
        >
          {tag.tag_name}
        </button>
      ))}
    </div>
  );
};

export default TagSelector;

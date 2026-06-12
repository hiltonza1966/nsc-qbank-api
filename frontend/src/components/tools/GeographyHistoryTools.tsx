import React, { useState } from 'react';

interface GeographyHistoryToolsProps {
  onInsert: (content: string, type: 'map' | 'timeline' | 'source') => void;
}

const GeographyHistoryTools: React.FC<GeographyHistoryToolsProps> = ({ onInsert }) => {
  const [activeTab, setActiveTab] = useState<'map' | 'timeline' | 'source'>('map');
  const [timelineEvents, setTimelineEvents] = useState([
    { year: '1994', event: 'First democratic elections in South Africa' },
    { year: '', event: '' },
  ]);
  const [sourceText, setSourceText] = useState('');
  const [sourceType, setSourceType] = useState('document');

  const mapRegions = [
    { name: 'South Africa - Provinces', code: 'SA_PROVINCES' },
    { name: 'South Africa - Biomes', code: 'SA_BIOMES' },
    { name: 'Africa - Political', code: 'AFRICA_POLITICAL' },
    { name: 'World - Climate', code: 'WORLD_CLIMATE' },
  ];

  const updateTimeline = (index: number, field: 'year' | 'event', value: string) => {
    const newEvents = [...timelineEvents];
    newEvents[index][field] = value;
    setTimelineEvents(newEvents);
  };

  const addTimelineEvent = () => {
    setTimelineEvents([...timelineEvents, { year: '', event: '' }]);
  };

  const insertTimeline = () => {
    const formatted = timelineEvents
      .filter(e => e.year && e.event)
      .map(e => e.year + ': ' + e.event)
      .join(String.fromCharCode(10));
    onInsert(formatted, 'timeline');
  };

  return (
    <div className="bg-white border rounded-lg shadow-sm">
      <div className="flex border-b">
        {(['map', 'timeline', 'source'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === tab ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'map' && 'Map Tool'}
            {tab === 'timeline' && 'Timeline'}
            {tab === 'source' && 'Source Document'}
          </button>
        ))}
      </div>

      <div className="p-4">
        {activeTab === 'map' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {mapRegions.map((region) => (
                <button
                  key={region.code}
                  onClick={() => onInsert('[MAP:' + region.code + '] ' + region.name, 'map')}
                  className="p-3 border rounded hover:bg-blue-50 text-left text-sm"
                >
                  <p className="font-medium">{region.name}</p>
                  <p className="text-xs text-gray-500">Insert map template</p>
                </button>
              ))}
            </div>
            <div className="border rounded p-4 bg-gray-50">
              <p className="text-sm text-gray-600 mb-2">Map annotation placeholder:</p>
              <div className="h-32 border bg-white rounded flex items-center justify-center">
                <p className="text-gray-400">Map will render here in production</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="space-y-3">
            {timelineEvents.map((event, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  value={event.year}
                  onChange={(e) => updateTimeline(idx, 'year', e.target.value)}
                  placeholder="Year"
                  className="w-24 border rounded px-2 py-1 text-sm"
                />
                <input
                  value={event.event}
                  onChange={(e) => updateTimeline(idx, 'event', e.target.value)}
                  placeholder="Event description"
                  className="flex-1 border rounded px-2 py-1 text-sm"
                />
              </div>
            ))}
            <div className="flex gap-2">
              <button onClick={addTimelineEvent} className="bg-gray-200 px-3 py-1 rounded text-sm">+ Event</button>
              <button onClick={insertTimeline} className="bg-blue-600 text-white px-4 py-1 rounded text-sm">Insert Timeline</button>
            </div>
          </div>
        )}

        {activeTab === 'source' && (
          <div className="space-y-3">
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              className="border rounded px-3 py-2 text-sm"
            >
              <option value="document">Historical Document</option>
              <option value="cartoon">Political Cartoon</option>
              <option value="photograph">Photograph</option>
              <option value="graph">Data Graph</option>
              <option value="quote">Direct Quote</option>
            </select>
            <textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder="Paste source text or description..."
              className="w-full border rounded px-3 py-2 h-32"
            />
            <button
              onClick={() => sourceText && onInsert('[SOURCE:' + sourceType + ']' + String.fromCharCode(10) + sourceText, 'source')}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm"
              disabled={!sourceText}
            >
              Insert Source Document
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default GeographyHistoryTools;

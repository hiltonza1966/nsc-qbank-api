import React, { useState, useRef } from 'react';

interface LanguageToolsProps {
  onInsert: (content: string, type: 'audio' | 'rubric' | 'text' | 'highlight') => void;
}

const LanguageTools: React.FC<LanguageToolsProps> = ({ onInsert }) => {
  const [activeTab, setActiveTab] = useState<'audio' | 'rubric' | 'text' | 'highlight'>('audio');
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');
  const [rubricLevels, setRubricLevels] = useState([
    { level: 'Excellent', descriptor: 'Clear, well-structured response with excellent language use' },
    { level: 'Good', descriptor: 'Good response with minor language errors' },
    { level: 'Satisfactory', descriptor: 'Adequate response with some errors' },
    { level: 'Poor', descriptor: 'Limited response with significant errors' },
  ]);
  const [passageText, setPassageText] = useState('');
  const [highlightedText, setHighlightedText] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        onInsert(url, 'audio');
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
    } catch (err) {
      alert('Microphone access denied or not available');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const updateRubric = (index: number, field: 'level' | 'descriptor', value: string) => {
    const newLevels = [...rubricLevels];
    newLevels[index][field] = value;
    setRubricLevels(newLevels);
  };

  const insertRubric = () => {
    const formatted = rubricLevels.map(l => l.level + ': ' + l.descriptor).join(String.fromCharCode(10));
    onInsert(formatted, 'rubric');
  };

  const analyzeText = () => {
    const words = passageText.split(/\s+/).filter(w => w.length > 0);
    const sentences = passageText.split(/[.!?]+/).filter(s => s.length > 0);
    const analysis = 'Word count: ' + words.length + String.fromCharCode(10) + 'Sentence count: ' + sentences.length + String.fromCharCode(10) + 'Average sentence length: ' + (words.length / sentences.length).toFixed(1) + ' words';
    onInsert(analysis, 'text');
  };

  const handleHighlight = () => {
    const selection = window.getSelection()?.toString();
    if (selection) {
      setHighlightedText(selection);
      onInsert('[HIGHLIGHTED: ' + selection + ']', 'highlight');
    }
  };

  return (
    <div className="bg-white border rounded-lg shadow-sm">
      <div className="flex border-b">
        {(['audio', 'rubric', 'text', 'highlight'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === tab ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'audio' && 'Audio'}
            {tab === 'rubric' && 'Rubric'}
            {tab === 'text' && 'Analysis'}
            {tab === 'highlight' && 'Highlighter'}
          </button>
        ))}
      </div>

      <div className="p-4">
        {activeTab === 'audio' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`px-4 py-2 rounded text-sm ${
                  isRecording ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'
                }`}
              >
                {isRecording ? 'Stop Recording' : 'Start Recording'}
              </button>
              {isRecording && <span className="text-red-600 animate-pulse">Recording...</span>}
            </div>
            {audioUrl && (
              <div>
                <audio src={audioUrl} controls className="w-full" />
                <p className="text-xs text-gray-500 mt-1">Audio uploaded to item</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'rubric' && (
          <div className="space-y-3">
            {rubricLevels.map((level, idx) => (
              <div key={idx} className="border rounded p-2">
                <input
                  value={level.level}
                  onChange={(e) => updateRubric(idx, 'level', e.target.value)}
                  className="w-full border-b px-2 py-1 font-medium text-sm mb-1"
                />
                <textarea
                  value={level.descriptor}
                  onChange={(e) => updateRubric(idx, 'descriptor', e.target.value)}
                  className="w-full border rounded px-2 py-1 text-sm h-16"
                />
              </div>
            ))}
            <button onClick={insertRubric} className="bg-blue-600 text-white px-4 py-2 rounded text-sm">Insert Rubric</button>
          </div>
        )}

        {activeTab === 'text' && (
          <div className="space-y-3">
            <textarea
              value={passageText}
              onChange={(e) => setPassageText(e.target.value)}
              placeholder="Paste passage for analysis..."
              className="w-full border rounded px-3 py-2 h-32"
            />
            <button onClick={analyzeText} className="bg-blue-600 text-white px-4 py-2 rounded text-sm">Analyze & Insert</button>
          </div>
        )}

        {activeTab === 'highlight' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Select text in the question editor, then click highlight:</p>
            <button onClick={handleHighlight} className="bg-yellow-400 text-gray-900 px-4 py-2 rounded text-sm">Highlight Selection</button>
            {highlightedText && (
              <p className="text-sm bg-yellow-100 p-2 rounded">Last highlighted: {highlightedText}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LanguageTools;

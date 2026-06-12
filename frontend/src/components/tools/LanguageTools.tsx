import React, { useState, useRef } from 'react';

interface LanguageToolsProps {
  onInsert: (field: string, content: string) => void;
}

const LanguageTools: React.FC<LanguageToolsProps> = ({ onInsert }) => {
  const [activeTab, setActiveTab] = useState<'audio' | 'rubric' | 'text' | 'highlight'>('audio');
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [rubricLevels, setRubricLevels] = useState([
    { level: '7 - Outstanding', descriptor: 'Exceptional command of language with sophisticated vocabulary and complex structures', marks: 7 },
    { level: '6 - Meritorious', descriptor: 'Very good language use with minor errors', marks: 6 },
    { level: '5 - Substantial', descriptor: 'Good language use with some errors', marks: 5 },
    { level: '4 - Adequate', descriptor: 'Adequate response with noticeable errors', marks: 4 },
    { level: '3 - Moderate', descriptor: 'Limited language use with frequent errors', marks: 3 },
    { level: '2 - Elementary', descriptor: 'Basic language use with many errors', marks: 2 },
    { level: '1 - Not achieved', descriptor: 'Very limited or no relevant response', marks: 1 },
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
        setAudioBlob(blob);
        onInsert('item_media_audio', url);
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

  const updateRubric = (index: number, field: 'level' | 'descriptor' | 'marks', value: string | number) => {
    const newLevels = [...rubricLevels];
    if (field === 'marks') {
      newLevels[index] = { ...newLevels[index], [field]: Number(value) };
    } else {
      newLevels[index] = { ...newLevels[index], [field]: String(value) };
    }
    setRubricLevels(newLevels);
  };

  const insertRubric = () => {
    const rubricJson = JSON.stringify({ levels: rubricLevels });
    onInsert('item_rubric_json', rubricJson);
  };

  const analyzeText = () => {
    const words = passageText.split(/\s+/).filter(w => w.length > 0);
    const sentences = passageText.split(/[.!?]+/).filter(s => s.length > 0);
    const analysis = 'Word count: ' + words.length + String.fromCharCode(10) + 'Sentence count: ' + sentences.length + String.fromCharCode(10) + 'Average sentence length: ' + (words.length / sentences.length).toFixed(1) + ' words' + String.fromCharCode(10) + 'Estimated reading time: ' + Math.ceil(words.length / 200) + ' minutes';
    onInsert('item_stem_html', '<div class="text-analysis"><p>' + analysis.split(String.fromCharCode(10)).join('</p><p>') + '</p></div>');
  };

  const handleHighlight = () => {
    const selection = window.getSelection()?.toString();
    if (selection) {
      setHighlightedText(selection);
      onInsert('item_stem_html', '<span class="highlighted-passage">' + selection + '</span>');
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
                <p className="text-xs text-gray-500 mt-1">Audio saved to item_media_audio (encrypted storage)</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'rubric' && (
          <div className="space-y-3">
            {rubricLevels.map((level, idx) => (
              <div key={idx} className="border rounded p-2">
                <div className="flex gap-2 mb-1">
                  <input
                    value={level.level}
                    onChange={(e) => updateRubric(idx, 'level', e.target.value)}
                    className="flex-1 border-b px-2 py-1 font-medium text-sm"
                  />
                  <input
                    type="number"
                    value={level.marks}
                    onChange={(e) => updateRubric(idx, 'marks', Number(e.target.value))}
                    className="w-16 border rounded px-2 py-1 text-sm text-center"
                  />
                </div>
                <textarea
                  value={level.descriptor}
                  onChange={(e) => updateRubric(idx, 'descriptor', e.target.value)}
                  className="w-full border rounded px-2 py-1 text-sm h-16"
                />
              </div>
            ))}
            <button onClick={insertRubric} className="bg-blue-600 text-white px-4 py-2 rounded text-sm">Save Rubric (item_rubric_json)</button>
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
            <button onClick={analyzeText} className="bg-blue-600 text-white px-4 py-2 rounded text-sm">Analyze & Save (item_stem_html)</button>
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

import React, { useState } from 'react';

interface ITToolsProps {
  onInsert: (content: string, type: 'code' | 'screenshot' | 'file') => void;
}

const ITTools: React.FC<ITToolsProps> = ({ onInsert }) => {
  const [activeTab, setActiveTab] = useState<'code' | 'screenshot' | 'file'>('code');
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('python');
  const [fileName, setFileName] = useState('');

  const languages = [
    { id: 'python', label: 'Python', template: 'def main():' + String.fromCharCode(10) + '    # Your code here' + String.fromCharCode(10) + '    pass' + String.fromCharCode(10) + String.fromCharCode(10) + 'if __name__ == "__main__":' + String.fromCharCode(10) + '    main()' },
    { id: 'delphi', label: 'Delphi', template: 'program Hello;' + String.fromCharCode(10) + 'begin' + String.fromCharCode(10) + '  writeln("Hello World");' + String.fromCharCode(10) + 'end.' },
    { id: 'html', label: 'HTML', template: '<!DOCTYPE html>' + String.fromCharCode(10) + '<html>' + String.fromCharCode(10) + '<head>' + String.fromCharCode(10) + '  <title>Page</title>' + String.fromCharCode(10) + '</head>' + String.fromCharCode(10) + '<body>' + String.fromCharCode(10) + '  <!-- Content -->' + String.fromCharCode(10) + '</body>' + String.fromCharCode(10) + '</html>' },
    { id: 'javascript', label: 'JavaScript', template: 'function main() {' + String.fromCharCode(10) + '  // Your code here' + String.fromCharCode(10) + '  console.log("Hello World");' + String.fromCharCode(10) + '}' + String.fromCharCode(10) + String.fromCharCode(10) + 'main();' },
  ];

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    const template = languages.find(l => l.id === lang)?.template || '';
    setCode(template);
  };

  const insertCode = () => {
    if (code) {
      onInsert('[CODE:' + language + ']' + String.fromCharCode(10) + code + String.fromCharCode(10) + '[/CODE]', 'code');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        onInsert('[FILE:' + file.name + ']' + String.fromCharCode(10) + (event.target?.result || ''), 'file');
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="bg-white border rounded-lg shadow-sm">
      <div className="flex border-b">
        {(['code', 'screenshot', 'file'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === tab ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'code' && 'Code Editor'}
            {tab === 'screenshot' && 'Screenshot'}
            {tab === 'file' && 'File Upload'}
          </button>
        ))}
      </div>

      <div className="p-4">
        {activeTab === 'code' && (
          <div className="space-y-3">
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="border rounded px-3 py-2 text-sm"
            >
              {languages.map(l => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full border rounded px-3 py-2 h-48 font-mono text-sm bg-gray-900 text-green-400"
              spellCheck={false}
            />
            <button onClick={insertCode} className="bg-blue-600 text-white px-4 py-2 rounded text-sm">Insert Code</button>
          </div>
        )}

        {activeTab === 'screenshot' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Use browser screenshot tools or paste image:</p>
            <div
              className="border-2 border-dashed border-gray-300 rounded p-8 text-center cursor-pointer hover:border-blue-500"
              onPaste={(e) => {
                const items = e.clipboardData.items;
                for (let i = 0; i < items.length; i++) {
                  if (items[i].type.indexOf('image') !== -1) {
                    const blob = items[i].getAsFile();
                    if (blob) {
                      const url = URL.createObjectURL(blob);
                      onInsert(url, 'screenshot');
                    }
                  }
                }
              }}
            >
              <p className="text-gray-500">Press Print Screen, then click here and paste (Ctrl+V)</p>
            </div>
          </div>
        )}

        {activeTab === 'file' && (
          <div className="space-y-3">
            <input
              type="file"
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {fileName && <p className="text-sm text-green-600">Selected: {fileName}</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default ITTools;

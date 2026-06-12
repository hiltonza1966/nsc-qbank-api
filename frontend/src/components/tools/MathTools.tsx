import React, { useState, useRef, useEffect } from 'react';

interface MathToolsProps {
  onInsert: (field: string, content: string) => void;
}

const MathTools: React.FC<MathToolsProps> = ({ onInsert }) => {
  const [activeTab, setActiveTab] = useState<'latex' | 'equation' | 'graph' | 'geometry'>('latex');
  const [latexInput, setLatexInput] = useState('');
  const [preview, setPreview] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (latexInput) {
      setPreview('\\(' + latexInput + '\\)');
    } else {
      setPreview('');
    }
  }, [latexInput]);

  const equationTemplates = [
    { label: 'Fraction', latex: '\\frac{a}{b}' },
    { label: 'Square Root', latex: '\\sqrt{x}' },
    { label: 'Quadratic', latex: 'x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}' },
    { label: 'Integral', latex: '\\int_{a}^{b} f(x) \, dx' },
    { label: 'Summation', latex: '\\sum_{i=1}^{n} x_i' },
    { label: 'Matrix', latex: '\\begin{pmatrix} a & b \\ c & d \\end{pmatrix}' },
  ];

  const handleInsertLatex = () => {
    if (latexInput) {
      onInsert('item_stem_latex', latexInput);
      setLatexInput('');
    }
  };

  const drawGraph = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(50, 200);
    ctx.lineTo(350, 200);
    ctx.moveTo(200, 50);
    ctx.lineTo(200, 350);
    ctx.stroke();

    ctx.strokeStyle = '#2563eb';
    ctx.beginPath();
    for (let x = -100; x <= 100; x += 2) {
      const y = -(x * x) / 50 + 200;
      const screenX = 200 + x;
      if (x === -100) ctx.moveTo(screenX, y);
      else ctx.lineTo(screenX, y);
    }
    ctx.stroke();

    const svgContent = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><line x1="50" y1="200" x2="350" y2="200" stroke="#333"/><line x1="200" y1="50" x2="200" y2="350" stroke="#333"/><path d="M 100 200 Q 200 0 300 200" stroke="#2563eb" fill="none"/></svg>';
    onInsert('item_media_svg', svgContent);
  };

  const drawGeometry = () => {
    const svgContent = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><polygon points="100,300 300,300 200,100" stroke="#333" fill="none" stroke-width="2"/><text x="90" y="320">A</text><text x="310" y="320">B</text><text x="190" y="90">C</text></svg>';
    onInsert('item_media_svg', svgContent);
  };

  return (
    <div className="bg-white border rounded-lg shadow-sm">
      <div className="flex border-b">
        {(['latex', 'equation', 'graph', 'geometry'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === tab ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'latex' && 'LaTeX'}
            {tab === 'equation' && 'Equations'}
            {tab === 'graph' && 'Graphs'}
            {tab === 'geometry' && 'Geometry'}
          </button>
        ))}
      </div>

      <div className="p-4">
        {activeTab === 'latex' && (
          <div className="space-y-3">
            <textarea
              value={latexInput}
              onChange={(e) => setLatexInput(e.target.value)}
              placeholder="Enter LaTeX: e.g., x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}"
              className="w-full border rounded px-3 py-2 h-24 font-mono text-sm"
            />
            {preview && (
              <div className="bg-gray-50 p-3 rounded border">
                <p className="text-xs text-gray-500 mb-1">Preview:</p>
                <p className="font-mono">{preview}</p>
              </div>
            )}
            <button
              onClick={handleInsertLatex}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
              disabled={!latexInput}
            >
              Insert LaTeX (saves to item_stem_latex)
            </button>
          </div>
        )}

        {activeTab === 'equation' && (
          <div className="grid grid-cols-2 gap-2">
            {equationTemplates.map((template) => (
              <button
                key={template.label}
                onClick={() => {
                  setLatexInput(template.latex);
                  setActiveTab('latex');
                }}
                className="p-3 border rounded hover:bg-blue-50 text-left text-sm"
              >
                <p className="font-medium">{template.label}</p>
                <p className="text-xs text-gray-500 font-mono mt-1">{template.latex}</p>
              </button>
            ))}
          </div>
        )}

        {activeTab === 'graph' && (
          <div className="space-y-3">
            <canvas
              ref={canvasRef}
              width={400}
              height={400}
              className="border rounded bg-white"
            />
            <button
              onClick={drawGraph}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
            >
              Plot & Save as SVG (item_media_svg)
            </button>
          </div>
        )}

        {activeTab === 'geometry' && (
          <div className="space-y-3">
            <div className="border rounded p-4 bg-gray-50 h-64 flex items-center justify-center">
              <svg width="300" height="200" viewBox="0 0 300 200">
                <polygon points="50,150 250,150 150,30" stroke="#333" fill="none" strokeWidth="2"/>
                <text x="40" y="170">A</text>
                <text x="260" y="170">B</text>
                <text x="140" y="20">C</text>
              </svg>
            </div>
            <button
              onClick={drawGeometry}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
            >
              Save Geometry as SVG (item_media_svg)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MathTools;

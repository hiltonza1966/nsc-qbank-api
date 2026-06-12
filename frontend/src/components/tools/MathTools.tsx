import React, { useState, useRef, useEffect } from 'react';

interface MathToolsProps {
  onInsert: (content: string, type: 'latex' | 'equation' | 'graph' | 'geometry') => void;
}

const MathTools: React.FC<MathToolsProps> = ({ onInsert }) => {
  const [activeTab, setActiveTab] = useState<'latex' | 'equation' | 'graph' | 'geometry'>('latex');
  const [latexInput, setLatexInput] = useState('');
  const [preview, setPreview] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // LaTeX preview using simple rendering (MathJax would be loaded in production)
  useEffect(() => {
    if (latexInput) {
      setPreview(`\(${latexInput}\)`);
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
      onInsert(latexInput, 'latex');
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

    // Draw axes
    ctx.beginPath();
    ctx.moveTo(50, 200);
    ctx.lineTo(350, 200);
    ctx.moveTo(200, 50);
    ctx.lineTo(200, 350);
    ctx.stroke();

    // Draw parabola
    ctx.strokeStyle = '#2563eb';
    ctx.beginPath();
    for (let x = -100; x <= 100; x += 2) {
      const y = -(x * x) / 50 + 200;
      const screenX = 200 + x;
      if (x === -100) ctx.moveTo(screenX, y);
      else ctx.lineTo(screenX, y);
    }
    ctx.stroke();

    // Export as image
    const dataUrl = canvas.toDataURL('image/png');
    onInsert(dataUrl, 'graph');
  };

  const drawGeometry = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw triangle
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(100, 300);
    ctx.lineTo(300, 300);
    ctx.lineTo(200, 100);
    ctx.closePath();
    ctx.stroke();

    // Label angles
    ctx.font = '16px Arial';
    ctx.fillStyle = '#333';
    ctx.fillText('A', 90, 320);
    ctx.fillText('B', 310, 320);
    ctx.fillText('C', 190, 90);

    const dataUrl = canvas.toDataURL('image/png');
    onInsert(dataUrl, 'geometry');
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
              placeholder="Enter LaTeX: e.g., x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}"
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
              Insert LaTeX
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
              Plot & Insert Graph
            </button>
          </div>
        )}

        {activeTab === 'geometry' && (
          <div className="space-y-3">
            <canvas
              ref={canvasRef}
              width={400}
              height={400}
              className="border rounded bg-white"
            />
            <button
              onClick={drawGeometry}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
            >
              Draw & Insert Geometry
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MathTools;

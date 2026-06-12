import React, { useState } from 'react';

interface ScienceToolsProps {
  onInsert: (content: string, type: 'chem' | 'diagram' | 'unit') => void;
}

const ScienceTools: React.FC<ScienceToolsProps> = ({ onInsert }) => {
  const [activeTab, setActiveTab] = useState<'chem' | 'diagram' | 'unit'>('chem');
  const [chemEquation, setChemEquation] = useState('');
  const [unitValue, setUnitValue] = useState('');
  const [unitFrom, setUnitFrom] = useState('m');
  const [unitTo, setUnitTo] = useState('cm');

  const chemTemplates = [
    { label: 'Combustion', eq: 'C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O' },
    { label: 'Photosynthesis', eq: '6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂' },
    { label: 'Neutralization', eq: 'HCl + NaOH → NaCl + H₂O' },
    { label: 'Decomposition', eq: '2H₂O → 2H₂ + O₂' },
  ];

  const unitConversions: Record<string, Record<string, number>> = {
    'm': { 'cm': 100, 'mm': 1000, 'km': 0.001 },
    'cm': { 'm': 0.01, 'mm': 10, 'km': 0.00001 },
    'g': { 'kg': 0.001, 'mg': 1000 },
    'kg': { 'g': 1000, 'mg': 1000000 },
    's': { 'min': 1/60, 'h': 1/3600 },
    'min': { 's': 60, 'h': 1/60 },
    'N': { 'kN': 0.001 },
    'J': { 'kJ': 0.001 },
  };

  const convertUnit = () => {
    const val = parseFloat(unitValue);
    if (isNaN(val)) return;
    const conversion = unitConversions[unitFrom]?.[unitTo];
    if (conversion) {
      const result = val * conversion;
      onInsert(`${val} ${unitFrom} = ${result.toExponential(3)} ${unitTo}`, 'unit');
    }
  };

  return (
    <div className="bg-white border rounded-lg shadow-sm">
      <div className="flex border-b">
        {(['chem', 'diagram', 'unit'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === tab ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'chem' && 'Chemical Equations'}
            {tab === 'diagram' && 'Diagrams'}
            {tab === 'unit' && 'Unit Converter'}
          </button>
        ))}
      </div>

      <div className="p-4">
        {activeTab === 'chem' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {chemTemplates.map((template) => (
                <button
                  key={template.label}
                  onClick={() => setChemEquation(template.eq)}
                  className="p-3 border rounded hover:bg-blue-50 text-left text-sm"
                >
                  <p className="font-medium">{template.label}</p>
                  <p className="text-xs text-gray-500 mt-1">{template.eq}</p>
                </button>
              ))}
            </div>
            <textarea
              value={chemEquation}
              onChange={(e) => setChemEquation(e.target.value)}
              placeholder="Enter chemical equation..."
              className="w-full border rounded px-3 py-2 h-20 font-mono text-sm"
            />
            <button
              onClick={() => chemEquation && onInsert(chemEquation, 'chem')}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
              disabled={!chemEquation}
            >
              Insert Equation
            </button>
          </div>
        )}

        {activeTab === 'diagram' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {['Circuit Diagram', 'Cell Structure', 'Periodic Table', 'Food Web'].map(d => (
                <button
                  key={d}
                  onClick={() => onInsert(`[DIAGRAM: ${d}]`, 'diagram')}
                  className="p-3 border rounded hover:bg-blue-50 text-left text-sm"
                >
                  <p className="font-medium">{d}</p>
                  <p className="text-xs text-gray-500">Insert template</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'unit' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="number"
                value={unitValue}
                onChange={(e) => setUnitValue(e.target.value)}
                placeholder="Value"
                className="border rounded px-3 py-2 w-24"
              />
              <select
                value={unitFrom}
                onChange={(e) => setUnitFrom(e.target.value)}
                className="border rounded px-3 py-2"
              >
                {Object.keys(unitConversions).map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
              <span className="py-2">→</span>
              <select
                value={unitTo}
                onChange={(e) => setUnitTo(e.target.value)}
                className="border rounded px-3 py-2"
              >
                {unitConversions[unitFrom] && Object.keys(unitConversions[unitFrom]).map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <button
              onClick={convertUnit}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
            >
              Convert & Insert
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScienceTools;

import React, { useState } from 'react';

interface AccountingToolsProps {
  onInsert: (content: string, type: 'table' | 'calculator' | 'case') => void;
}

const AccountingTools: React.FC<AccountingToolsProps> = ({ onInsert }) => {
  const [activeTab, setActiveTab] = useState<'table' | 'calculator' | 'case'>('table');
  const [tableData, setTableData] = useState([['Account', 'Debit', 'Credit'], ['', '', '']]);
  const [calcInput, setCalcInput] = useState('');
  const [caseText, setCaseText] = useState('');

  const addTableRow = () => {
    setTableData([...tableData, ['', '', '']]);
  };

  const updateCell = (row: number, col: number, value: string) => {
    const newData = [...tableData];
    newData[row][col] = value;
    setTableData(newData);
  };

  const insertTable = () => {
    const formatted = tableData.map(row => row.join(' | ')).join(String.fromCharCode(10));
    onInsert(formatted, 'table');
  };

  const calculate = () => {
    try {
      const result = eval(calcInput.replace(/[^0-9+\-*/.()]/g, ''));
      onInsert(calcInput + ' = ' + result, 'calculator');
    } catch {
      onInsert('Error: ' + calcInput, 'calculator');
    }
  };

  return (
    <div className="bg-white border rounded-lg shadow-sm">
      <div className="flex border-b">
        {(['table', 'calculator', 'case'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === tab ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'table' && 'Table Builder'}
            {tab === 'calculator' && 'Calculator'}
            {tab === 'case' && 'Case Study'}
          </button>
        ))}
      </div>

      <div className="p-4">
        {activeTab === 'table' && (
          <div className="space-y-3">
            <div className="border rounded">
              {tableData.map((row, rowIdx) => (
                <div key={rowIdx} className="flex border-b last:border-b-0">
                  {row.map((cell, colIdx) => (
                    <input
                      key={colIdx}
                      value={cell}
                      onChange={(e) => updateCell(rowIdx, colIdx, e.target.value)}
                      className="flex-1 px-2 py-1 border-r last:border-r-0 text-sm"
                      placeholder={rowIdx === 0 ? ['Account', 'Debit', 'Credit'][colIdx] : ''}
                    />
                  ))}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={addTableRow} className="bg-gray-200 px-3 py-1 rounded text-sm">+ Row</button>
              <button onClick={insertTable} className="bg-blue-600 text-white px-4 py-1 rounded text-sm">Insert Table</button>
            </div>
          </div>
        )}

        {activeTab === 'calculator' && (
          <div className="space-y-3">
            <input
              value={calcInput}
              onChange={(e) => setCalcInput(e.target.value)}
              placeholder="e.g., 1000 * 0.15 + 500"
              className="w-full border rounded px-3 py-2 font-mono"
            />
            <button onClick={calculate} className="bg-blue-600 text-white px-4 py-2 rounded text-sm">Calculate & Insert</button>
          </div>
        )}

        {activeTab === 'case' && (
          <div className="space-y-3">
            <textarea
              value={caseText}
              onChange={(e) => setCaseText(e.target.value)}
              placeholder="Enter case study scenario..."
              className="w-full border rounded px-3 py-2 h-32"
            />
            <button
              onClick={() => caseText && onInsert(caseText, 'case')}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm"
              disabled={!caseText}
            >
              Insert Case Study
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountingTools;

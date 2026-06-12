import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { itemsApi } from '../services/api';

interface VersionDiffProps {
  itemId: string;
  onClose: () => void;
}

const VersionDiff: React.FC<VersionDiffProps> = ({ itemId, onClose }) => {
  const [selectedVersions, setSelectedVersions] = useState<[number, number]>([0, 1]);

  const { data: versions } = useQuery({
    queryKey: ['versions', itemId],
    queryFn: () => itemsApi.getVersions(itemId)
  });

  const versionList = versions?.versions || [];

  const getDiff = (oldText: string, newText: string) => {
    const separator = String.fromCharCode(10);
    const oldLines = oldText.split(separator);
    const newLines = newText.split(separator);

    return newLines.map((line, idx) => {
      if (idx >= oldLines.length) return { type: 'added', content: line };
      if (line !== oldLines[idx]) return { type: 'modified', content: line, old: oldLines[idx] };
      return { type: 'same', content: line };
    });
  };

  const oldVersion = versionList[selectedVersions[0]];
  const newVersion = versionList[selectedVersions[1]];
  const diff = oldVersion && newVersion ? getDiff(oldVersion.question_text || '', newVersion.question_text || '') : [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-auto m-4">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="text-lg font-semibold">Version History & Diff</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl">&times;</button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Old Version</label>
              <select
                value={selectedVersions[0]}
                onChange={(e) => setSelectedVersions([Number(e.target.value), selectedVersions[1]])}
                className="border rounded px-3 py-2"
              >
                {versionList.map((v: any, idx: number) => (
                  <option key={idx} value={idx}>v{v.version_number} ({new Date(v.created_at).toLocaleDateString()})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">New Version</label>
              <select
                value={selectedVersions[1]}
                onChange={(e) => setSelectedVersions([selectedVersions[0], Number(e.target.value)])}
                className="border rounded px-3 py-2"
              >
                {versionList.map((v: any, idx: number) => (
                  <option key={idx} value={idx}>v{v.version_number} ({new Date(v.created_at).toLocaleDateString()})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="border rounded bg-gray-50 p-4 font-mono text-sm space-y-1">
            {diff.length === 0 ? (
              <p className="text-gray-500">Select two versions to compare</p>
            ) : (
              diff.map((line: any, idx: number) => (
                <div
                  key={idx}
                  className={`px-2 py-1 rounded ${
                    line.type === 'added' ? 'bg-green-100 text-green-800' :
                    line.type === 'modified' ? 'bg-yellow-100 text-yellow-800' :
                    'text-gray-600'
                  }`}
                >
                  {line.type === 'added' && '+ '}
                  {line.type === 'modified' && '~ '}
                  {line.type === 'same' && '  '}
                  {line.content}
                  {line.old && <span className="text-red-600 ml-2">(was: {line.old})</span>}
                </div>
              ))
            )}
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium mb-2">All Versions</h4>
            <div className="space-y-2">
              {versionList.map((v: any) => (
                <div key={v.version_id} className="flex justify-between p-2 bg-gray-50 rounded text-sm">
                  <span>v{v.version_number}</span>
                  <span className="text-gray-500">{new Date(v.created_at).toLocaleDateString()}</span>
                  <span className="text-gray-500">{v.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VersionDiff;

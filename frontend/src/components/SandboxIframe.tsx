import React, { useRef, useEffect, useState } from 'react';

interface SandboxIframeProps {
  toolName: string;
  content: string;
  contentType: 'latex' | 'html' | 'code' | 'svg' | 'audio' | 'rubric' | 'json';
  onSave?: (content: string) => void;
  readOnly?: boolean;
}

const SandboxIframe: React.FC<SandboxIframeProps> = ({ toolName, content, contentType, onSave, readOnly = false }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cspPolicy, setCspPolicy] = useState('');

  useEffect(() => {
    // Fetch CSP policy from backend
    fetch('http://localhost:4000/api/qbank/sandbox-config/' + toolName)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setCspPolicy(data.config?.csp_policy || '');
        }
      })
      .catch(() => {
        // Default locked-down CSP
        setCspPolicy("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-src 'self';");
      });
  }, [toolName]);

  useEffect(() => {
    if (!iframeRef.current || !cspPolicy) return;

    const iframe = iframeRef.current;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    // Build sandboxed HTML with CSP
    let htmlContent = '';

    switch (contentType) {
      case 'latex':
        htmlContent = buildLatexViewer(content);
        break;
      case 'svg':
        htmlContent = buildSvgViewer(content);
        break;
      case 'audio':
        htmlContent = buildAudioPlayer(content);
        break;
      case 'code':
        htmlContent = buildCodeViewer(content);
        break;
      case 'html':
        htmlContent = buildHtmlViewer(content);
        break;
      case 'rubric':
        htmlContent = buildRubricViewer(content);
        break;
      case 'json':
        htmlContent = buildJsonViewer(content);
        break;
      default:
        htmlContent = '<p>Unknown content type</p>';
    }

    const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="Content-Security-Policy" content="${cspPolicy}">
  <style>
    body { margin: 0; padding: 10px; font-family: system-ui, sans-serif; background: white; }
    * { box-sizing: border-box; }
  </style>
</head>
<body>${htmlContent}</body>
</html>`;

    doc.open();
    doc.write(fullHtml);
    doc.close();
    setIsLoading(false);

    // Block all external navigation
    iframe.sandbox = 'allow-scripts allow-same-origin';
  }, [content, contentType, cspPolicy]);

  const buildLatexViewer = (latex: string) => {
    return `<div style="padding: 10px; background: #f8f9fa; border-radius: 4px;">
      <p style="font-family: 'Courier New', monospace; white-space: pre-wrap; word-break: break-word;">${escapeHtml(latex)}</p>
      <p style="margin-top: 10px; color: #666; font-size: 12px;">[LaTeX rendering disabled in sandbox mode - server-side MathJax required for production]</p>
    </div>`;
  };

  const buildSvgViewer = (svg: string) => {
    return `<div style="border: 1px solid #ddd; border-radius: 4px; padding: 10px;">
      ${svg}
      <p style="margin-top: 10px; color: #666; font-size: 12px;">SVG Content (view-only)</p>
    </div>`;
  };

  const buildAudioPlayer = (audioUrl: string) => {
    return `<div style="padding: 10px;">
      <audio controls style="width: 100%;" src="${audioUrl}">
        Your browser does not support audio playback.
      </audio>
      <p style="margin-top: 10px; color: #666; font-size: 12px;">Audio content (view-only, no download)</p>
    </div>`;
  };

  const buildCodeViewer = (code: string) => {
    return `<div style="background: #1e1e1e; color: #d4d4d4; padding: 10px; border-radius: 4px; font-family: 'Courier New', monospace; white-space: pre-wrap; word-break: break-word; max-height: 400px; overflow: auto;">
      ${escapeHtml(code)}
    </div>`;
  };

  const buildHtmlViewer = (html: string) => {
    return `<div style="border: 1px solid #ddd; border-radius: 4px; padding: 10px; max-height: 400px; overflow: auto;">
      ${html}
    </div>`;
  };

  const buildRubricViewer = (rubricJson: string) => {
    try {
      const rubric = JSON.parse(rubricJson);
      let html = '<table style="width: 100%; border-collapse: collapse;">';
      html += '<tr style="background: #f0f0f0;"><th style="border: 1px solid #ddd; padding: 8px;">Level</th><th style="border: 1px solid #ddd; padding: 8px;">Descriptor</th><th style="border: 1px solid #ddd; padding: 8px;">Marks</th></tr>';
      rubric.levels?.forEach((level: any) => {
        html += `<tr><td style="border: 1px solid #ddd; padding: 8px;">${escapeHtml(level.level || '')}</td><td style="border: 1px solid #ddd; padding: 8px;">${escapeHtml(level.descriptor || '')}</td><td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${level.marks || 0}</td></tr>`;
      });
      html += '</table>';
      return html;
    } catch {
      return '<p>Invalid rubric format</p>';
    }
  };

  const buildJsonViewer = (json: string) => {
    try {
      const data = JSON.parse(json);
      return `<pre style="background: #f8f9fa; padding: 10px; border-radius: 4px; overflow: auto; max-height: 400px;">${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
    } catch {
      return `<pre style="background: #f8f9fa; padding: 10px; border-radius: 4px;">${escapeHtml(json)}</pre>`;
    }
  };

  const escapeHtml = (text: string) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  return (
    <div className="relative border rounded-lg overflow-hidden bg-white">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-100 border-b">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-600">{toolName}</span>
          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">SANDBOXED</span>
        </div>
        {!readOnly && onSave && (
          <button
            onClick={() => onSave(content)}
            className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
          >
            Save to Item
          </button>
        )}
      </div>
      {isLoading && (
        <div className="p-4 text-center text-gray-500 text-sm">Loading sandbox...</div>
      )}
      <iframe
        ref={iframeRef}
        className="w-full"
        style={{ height: '300px', border: 'none' }}
        title={`${toolName}-sandbox`}
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
};

export default SandboxIframe;

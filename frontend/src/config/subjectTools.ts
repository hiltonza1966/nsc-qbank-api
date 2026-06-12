export interface ToolConfig {
  id: string;
  name: string;
  icon: string;
  component: string;
  subjects: string[];
}

export const SUBJECT_TOOLS: ToolConfig[] = [
  // Mathematics tools
  { id: 'latex', name: 'LaTeX Editor', icon: '∑', component: 'MathTools', subjects: ['19331054', '19331064', '19331074'] },
  { id: 'equation', name: 'Equation Builder', icon: 'ƒ', component: 'MathTools', subjects: ['19331054', '19331064', '19331074'] },
  { id: 'graph', name: 'Graph Plotter', icon: '📈', component: 'MathTools', subjects: ['19331054', '19331064', '19331074'] },
  { id: 'geometry', name: 'Geometry Sketch', icon: '📐', component: 'MathTools', subjects: ['19331054', '19331064', '19331074'] },

  // Physical Sciences / Life Sciences
  { id: 'chem', name: 'Chemical Equation', icon: '⚗️', component: 'ScienceTools', subjects: ['19331084', '19331094', '19331104', '19331114'] },
  { id: 'diagram', name: 'Diagram Tool', icon: '🔬', component: 'ScienceTools', subjects: ['19331084', '19331094', '19331104', '19331114'] },
  { id: 'unit', name: 'Unit Converter', icon: '⚖️', component: 'ScienceTools', subjects: ['19331084', '19331094', '19331104', '19331114'] },

  // Accounting / Economics / Business
  { id: 'table', name: 'Table Builder', icon: '📊', component: 'AccountingTools', subjects: ['19331124', '19331134', '19331144'] },
  { id: 'calculator', name: 'Financial Calculator', icon: '🧮', component: 'AccountingTools', subjects: ['19331124', '19331134', '19331144'] },
  { id: 'case', name: 'Case Study Editor', icon: '📝', component: 'AccountingTools', subjects: ['19331124', '19331134', '19331144'] },

  // Languages (all 11)
  { id: 'audio', name: 'Audio Recorder', icon: '🎙️', component: 'LanguageTools', subjects: ['19321154', '19321164', '19321174', '19321184', '19321194', '19321204', '19321214', '19321224', '19321234', '19321244', '19321254'] },
  { id: 'rubric', name: 'Rubric Builder', icon: '📋', component: 'LanguageTools', subjects: ['19321154', '19321164', '19321174', '19321184', '19321194', '19321204', '19321214', '19321224', '19321234', '19321244', '19321254'] },
  { id: 'text', name: 'Text Analysis', icon: '📖', component: 'LanguageTools', subjects: ['19321154', '19321164', '19321174', '19321184', '19321194', '19321204', '19321214', '19321224', '19321234', '19321244', '19321254'] },
  { id: 'highlight', name: 'Passage Highlighter', icon: '🖍️', component: 'LanguageTools', subjects: ['19321154', '19321164', '19321174', '19321184', '19321194', '19321204', '19321214', '19321224', '19321234', '19321244', '19321254'] },

  // CAT / IT / Technical
  { id: 'code', name: 'Code Editor', icon: '💻', component: 'ITTools', subjects: ['19331224', '19331234', '19331244'] },
  { id: 'screenshot', name: 'Screenshot Tool', icon: '📷', component: 'ITTools', subjects: ['19331224', '19331234', '19331244'] },
  { id: 'file', name: 'File Attachment', icon: '📎', component: 'ITTools', subjects: ['19331224', '19331234', '19331244'] },

  // Geography / History / Social Sciences
  { id: 'map', name: 'Map Tool', icon: '🗺️', component: 'GeographyHistoryTools', subjects: ['19331154', '19331164', '19331174', '19331184'] },
  { id: 'timeline', name: 'Timeline Builder', icon: '⏳', component: 'GeographyHistoryTools', subjects: ['19331154', '19331164', '19331174', '19331184'] },
  { id: 'source', name: 'Source Document Viewer', icon: '📄', component: 'GeographyHistoryTools', subjects: ['19331154', '19331164', '19331174', '19331184'] },
];

export function getToolsForSubject(subjectCode: string): ToolConfig[] {
  return SUBJECT_TOOLS.filter(tool => tool.subjects.includes(subjectCode));
}

export function getAllToolSubjects(): string[] {
  return [...new Set(SUBJECT_TOOLS.flatMap(t => t.subjects))];
}

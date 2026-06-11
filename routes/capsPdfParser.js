/**
 * Generic CAPS PDF Parser â€” routes/capsPdfParser.js (v1.7 FINAL)
 * Fixed: Preserves all tests per grade, better paper extraction, matches DB schema
 */

const pdf = require('pdf-parse');
const fs = require('fs');
const path = require('path');

const CAPS_WEIGHTINGS = {
  10: { sba: 25, exam: 75, external: null, trial: null },
  11: { sba: 25, exam: 75, external: null, trial: null },
  12: { sba: 25, exam: null, external: 50, trial: 25 },
};

const PATTERNS = {
  section4Headers: [
    /SECTION\s+4[:\.]?\s*ASSESSMENT/i,
    /4\.4\s+Programme\s+of\s+Assessment/i,
    /4\.4\s+Assessment\s+Requirements/i,
    /Assessment\s+in\s+.+Grades\s+10[-â€“]12/i,
    /PROGRAMME\s+OF\s+FORMAL\s+ASSESSMENT/i,
    /PROGRAMME\s+OF\s+ASSESSMENT/i,
  ],
  assessmentTypes: [
    { type: 'trial_examination', regex: /trial\s+examination/i, is_exam: true, is_formal: true, is_practical: false, priority: 100 },
    { type: 'midyear_examination', regex: /mid[-\s]?year\s+examination/i, is_exam: true, is_formal: true, is_practical: false, priority: 100 },
    { type: 'end_of_year_examination', regex: /end[-\s]?of[-\s]?year\s+examination/i, is_exam: true, is_formal: true, is_practical: false, priority: 100 },
    { type: 'practical_examination', regex: /practical\s+examination/i, is_exam: false, is_formal: true, is_practical: true, priority: 90 },
    { type: 'practical_task', regex: /practical\s+task/i, is_exam: false, is_formal: true, is_practical: true, priority: 90 },
    { type: 'control_test', regex: /control\s+test/i, is_exam: false, is_formal: true, is_practical: false, priority: 80 },
    { type: 'written_report', regex: /written\s+report/i, is_exam: false, is_formal: true, is_practical: false, priority: 80 },
    { type: 'case_study', regex: /case\s+study/i, is_exam: false, is_formal: true, is_practical: false, priority: 80 },
    { type: 'presentation', regex: /presentation/i, is_exam: false, is_formal: true, is_practical: false, priority: 80 },
    { type: 'project', regex: /project/i, is_exam: false, is_formal: true, is_practical: false, priority: 80 },
    { type: 'assignment', regex: /assignment/i, is_exam: false, is_formal: true, is_practical: false, priority: 80 },
    { type: 'fieldwork', regex: /fieldwork/i, is_exam: false, is_formal: true, is_practical: false, priority: 80 },
    { type: 'oral', regex: /oral\b/i, is_exam: false, is_formal: true, is_practical: false, priority: 80 },
    { type: 'test', regex: /test\b/i, is_exam: false, is_formal: true, is_practical: false, priority: 70 },
    { type: 'examination', regex: /examination\b/i, is_exam: true, is_formal: true, is_practical: false, priority: 70 },
    { type: 'exam', regex: /exam\b/i, is_exam: true, is_formal: true, is_practical: false, priority: 60 },
  ],
  marksPatterns: [
    /\((\d+)\s*x\s*(\d+)\).*?\((\d+)\)/i,
    /\((\d+)\s*marks?\)/i,
    /minimum\s+of\s+(\d+)\s+marks/i,
    /\b(\d{2,3})\s*marks?\b/i,
    /\b(\d+)\s*mark\s+each\b/i,
    /Total\s+marks\s*[:\s]*(\d+)/i,
    /\((\d{2,3})\)\s*$/m,
  ],
  duration: /(\d+[Â½\/\.\d]*)\s*hours?/i,
  cognitiveDistribution: /(\d{1,2})[:\/](\d{1,2})[:\/](\d{1,2})/,
};

const SUBJECT_CORRUPTION_FIXES = {
  'IFE SCIENCES': 'LIFE SCIENCES',
  'IFE SCIENCE': 'LIFE SCIENCES',
  'CCOUNTING': 'ACCOUNTING',
  'CCOUNTIN': 'ACCOUNTING',
  'ATHEMATICS': 'MATHEMATICS',
  'HYSICAL SCIENCES': 'PHYSICAL SCIENCES',
  'EOGRAPHY': 'GEOGRAPHY',
  'ISTORY': 'HISTORY',
  'CONOMICS': 'ECONOMICS',
  'USINESS STUDIES': 'BUSINESS STUDIES',
  'OMPUTER APPLICATIONS TECHNOLOGY': 'COMPUTER APPLICATIONS TECHNOLOGY',
  'NFORMATION TECHNOLOGY': 'INFORMATION TECHNOLOGY',
  'GRICULTURAL SCIENCES': 'AGRICULTURAL SCIENCES',
  'ONSUMER STUDIES': 'CONSUMER STUDIES',
  'IFE ORIENTATION': 'LIFE ORIENTATION',
  'ELIGION STUDIES': 'RELIGION STUDIES',
  'RAMATIC ARTS': 'DRAMATIC ARTS',
  'ISUAL ARTS': 'VISUAL ARTS',
  'USIC': 'MUSIC',
  'ANCE STUDIES': 'DANCE STUDIES',
  'ESIGN': 'DESIGN',
  'OURISM': 'TOURISM',
  'OSPITALITY STUDIES': 'HOSPITALITY STUDIES',
};

const TERM_DISTRIBUTION = {
  'trial_examination': ['3'],
  'midyear_examination': ['2'],
  'end_of_year_examination': ['4'],
  'practical_examination': ['4'],
  'practical_task': ['1', '2', '3'],
  'control_test': ['2'],
  'written_report': ['1'],
  'case_study': ['3'],
  'presentation': ['1'],
  'project': ['4'],
  'assignment': ['4'],
  'fieldwork': ['3'],
  'oral': ['1'],
  'test': ['1', '2', '3', '4'],
  'examination': ['2', '4'],
  'exam': ['2', '4'],
};

class CapsPdfParser {
  constructor() {
    this.rawText = '';
    this.lines = [];
    this.subjectName = null;
    this.subjectCode = null;
  }

  async parse(pdfPath) {
    const dataBuffer = fs.readFileSync(pdfPath);
    const pdfData = await pdf(dataBuffer);
    this.rawText = pdfData.text;
    this.lines = this.rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    this._detectSubject();

    const section4Text = this._extractSection4();
    if (!section4Text) {
      throw new Error('Section 4 (Assessment) not found in PDF');
    }

    const grades = this._parseGradeBlocks(section4Text);

    return {
      subject_name: this.subjectName,
      subject_official_code: this.subjectCode,
      source_document: path.basename(pdfPath),
      extracted_at: new Date().toISOString(),
      parser_version: '1.7.0',
      grades: grades
    };
  }

  _detectSubject() {
    const headerLines = this.lines.slice(0, 50).join(' ');

    const subjectMatch = headerLines.match(/([A-Z][A-Z\s]+?)\s+GRADES\s+10[-â€“]12/i);
    if (subjectMatch) {
      this.subjectName = subjectMatch[1].trim().replace(/\s+/g, ' ');
    }

    for (let i = 0; i < Math.min(100, this.lines.length); i++) {
      const line = this.lines[i];
      const headerMatch = line.match(/^([A-Z][A-Z\s]+)\s+GRADES\s+10[-â€“]12/i);
      if (headerMatch && headerMatch[1].length > 3) {
        this.subjectName = headerMatch[1].trim().replace(/\s+/g, ' ');
        break;
      }
    }

    if (this.subjectName) {
      const upperName = this.subjectName.toUpperCase();
      for (const [corrupted, fixed] of Object.entries(SUBJECT_CORRUPTION_FIXES)) {
        if (upperName === corrupted || upperName.includes(corrupted)) {
          this.subjectName = fixed;
          break;
        }
      }
    }

    if (!this.subjectName) {
      const subjects = [
        'LIFE SCIENCES', 'ACCOUNTING', 'MATHEMATICS', 'PHYSICAL SCIENCES',
        'GEOGRAPHY', 'HISTORY', 'ECONOMICS', 'BUSINESS STUDIES',
        'ENGLISH HOME LANGUAGE', 'AFRIKAANS', 'ISIZULU', 'ISIXHOSA',
        'CONSUMER STUDIES', 'AGRICULTURAL SCIENCES', 'COMPUTER APPLICATIONS TECHNOLOGY',
        'INFORMATION TECHNOLOGY', 'TOURISM', 'HOSPITALITY STUDIES',
        'DRAMATIC ARTS', 'VISUAL ARTS', 'MUSIC', 'DANCE STUDIES',
        'DESIGN', 'LIFE ORIENTATION', 'RELIGION STUDIES'
      ];
      for (const subj of subjects) {
        if (headerLines.toUpperCase().includes(subj)) {
          this.subjectName = subj;
          break;
        }
      }
    }
  }

  _extractSection4() {
    const fullText = this.rawText;

    let startIdx = -1;
    for (const pattern of PATTERNS.section4Headers) {
      const match = fullText.search(pattern);
      if (match !== -1) {
        startIdx = match;
        break;
      }
    }

    if (startIdx === -1) return null;

    const endPatterns = [
      /SECTION\s+5[:\.]?\s*/i,
      /4\.8\s+General/i,
      /4\.7\s+Moderation/i,
      /ANNEXURE/i,
      /GLOSSARY/i,
    ];

    const lastGradeMatch = fullText.search(/GRADE\s+12\s+PROGRAMME/i);
    const minEndPos = lastGradeMatch !== -1 ? lastGradeMatch + 5000 : startIdx + 10000;

    let endIdx = fullText.length;
    for (const pattern of endPatterns) {
      const regex = new RegExp(pattern.source, 'gi');
      let match;
      let lastMatch = -1;
      while ((match = regex.exec(fullText)) !== null) {
        if (match.index > startIdx && match.index > minEndPos) {
          lastMatch = match.index;
        }
      }
      if (lastMatch !== -1) {
        endIdx = Math.min(endIdx, lastMatch);
      }
    }

    return fullText.substring(startIdx, endIdx);
  }

  _parseGradeBlocks(sectionText) {
    const grades = [];
    const gradeNumbers = [10, 11, 12];

    for (const gradeNum of gradeNumbers) {
      const gradeBlock = this._extractGradeBlock(sectionText, gradeNum);
      if (gradeBlock) {
        const gradeData = this._parseSingleGrade(gradeBlock, gradeNum);
        if (gradeData.assessments.length > 0 || gradeData.papers.length > 0) {
          grades.push(gradeData);
        }
      }
    }

    return grades;
  }

  _extractGradeBlock(text, gradeNum) {
    const allMatches = [];

    const capsPattern = new RegExp(`GRADE\\s+${gradeNum}\\s+PROGRAMME`, 'gi');
    let capsMatch;
    while ((capsMatch = capsPattern.exec(text)) !== null) {
      allMatches.push(capsMatch.index);
    }

    const titlePattern = new RegExp(`Grade\\s+${gradeNum}\\s*[:\\.]?\\s*Programme\\s+of\\s+(?:Formal\\s+)?Assessment`, 'gi');
    let titleMatch;
    while ((titleMatch = titlePattern.exec(text)) !== null) {
      allMatches.push(titleMatch.index);
    }

    if (allMatches.length === 0) return null;

    allMatches.sort((a, b) => a - b);
    const startIdx = allMatches[allMatches.length - 1];

    const nextGrade = gradeNum + 1;
    const endPatterns = [
      new RegExp(`GRADE\\s+${nextGrade}\\s+PROGRAMME`, 'i'),
      new RegExp(`Grade\\s+${nextGrade}\\s*[:\\.]?\\s*Programme`, 'i'),
      /4\.5\s+End-of-year/i,
      /4\.6\s+Recording/i,
      /4\.7\s+Moderation/i,
    ];

    let endIdx = text.length;
    for (const pattern of endPatterns) {
      const regex = new RegExp(pattern.source, 'i');
      const match = text.search(regex);
      if (match !== -1 && match > startIdx) {
        endIdx = Math.min(endIdx, match);
      }
    }

    const block = text.substring(startIdx, endIdx);

    if (!/Term\s+\d/i.test(block) && !/test\b/i.test(block) && !/examination\b/i.test(block)) {
      return null;
    }

    return block;
  }

  _parseSingleGrade(gradeBlock, gradeNum) {
    const weightings = CAPS_WEIGHTINGS[gradeNum];

    // Extract all unique assessments
    const rawAssessments = this._extractAllAssessments(gradeBlock);

    // Deduplicate and assign terms
    const assessments = this._deduplicateAndAssignTerms(rawAssessments, gradeNum);

    // Extract papers from the end-of-year section
    const papers = this._extractPaperStructure(gradeBlock);

    const cognitiveMatch = gradeBlock.match(PATTERNS.cognitiveDistribution);
    const cognitiveLevels = cognitiveMatch ? {
      level1_knowing: parseInt(cognitiveMatch[1]),
      level2_understanding: parseInt(cognitiveMatch[2]),
      level3_applying: parseInt(cognitiveMatch[3]),
      raw: cognitiveMatch[0]
    } : null;

    return {
      grade_value: gradeNum,
      sba_weighting: weightings.sba,
      exam_weighting: weightings.exam,
      external_weighting: weightings.external,
      trial_weighting: weightings.trial,
      cognitive_level_distribution: cognitiveLevels,
      assessments: assessments,
      papers: papers
    };
  }

  _extractAllAssessments(gradeBlock) {
    const found = [];

    for (const typeDef of PATTERNS.assessmentTypes) {
      const regex = new RegExp(typeDef.regex.source, 'gi');
      let match;

      while ((match = regex.exec(gradeBlock)) !== null) {
        const idx = match.index;
        const context = gradeBlock.substring(Math.max(0, idx - 150), Math.min(gradeBlock.length, idx + 150));

        let marks = null;

        for (const marksPattern of PATTERNS.marksPatterns) {
          const marksMatch = context.match(marksPattern);
          if (marksMatch) {
            if (marksMatch.length === 4) {
              marks = parseInt(marksMatch[3]);
            } else if (marksMatch.length === 3 && marksMatch[0].includes('x')) {
              marks = parseInt(marksMatch[1]) * parseInt(marksMatch[2]);
            } else {
              marks = parseInt(marksMatch[1]);
            }
            break;
          }
        }

        // Try to find term from context
        let term = null;
        const termMatch = context.match(/Term\s+(\d)/i);
        if (termMatch) {
          term = termMatch[1];
        }

        found.push({
          assessment_type: typeDef.type,
          term: term,
          raw_marks: marks,
          is_examination: typeDef.is_exam,
          is_formal: typeDef.is_formal,
          is_practical: typeDef.is_practical,
          is_compulsory: true,
          priority: typeDef.priority,
          position: idx,
          context_snippet: context.substring(0, 120).replace(/\s+/g, ' ').trim()
        });
      }
    }

    return found;
  }

  _deduplicateAndAssignTerms(rawAssessments, gradeNum) {
    // Sort by position
    rawAssessments.sort((a, b) => a.position - b.position);

    // Step 1: Remove duplicates at same position (keep highest priority)
    const deduped = [];
    const usedPositions = new Set();

    for (const assessment of rawAssessments) {
      const posBucket = Math.floor(assessment.position / 200); // 200-char buckets

      if (usedPositions.has(posBucket)) {
        // Check if existing is lower priority
        const existing = deduped.find(a => Math.floor(a.position / 200) === posBucket);
        if (existing && assessment.priority > existing.priority) {
          // Replace
          const idx = deduped.indexOf(existing);
          deduped[idx] = assessment;
        }
        // If same or lower priority, skip
      } else {
        usedPositions.add(posBucket);
        deduped.push(assessment);
      }
    }

    // Step 2: For tests, ensure we have exactly 4 (one per term)
    // If we have fewer than 4 tests, duplicate the last one to fill missing terms
    const tests = deduped.filter(a => a.assessment_type === 'test');
    const nonTests = deduped.filter(a => a.assessment_type !== 'test');

    const finalTests = [];
    const testTerms = new Set();

    for (const test of tests) {
      if (!testTerms.has(test.term)) {
        testTerms.add(test.term);
        finalTests.push(test);
      }
    }

    // Fill missing terms with copies
    for (let t = 1; t <= 4; t++) {
      const termStr = t.toString();
      if (!testTerms.has(termStr)) {
        const template = tests.length > 0 ? tests[tests.length - 1] : {
          assessment_type: 'test',
          raw_marks: 50,
          is_examination: false,
          is_formal: true,
          is_practical: false,
          is_compulsory: true,
          priority: 70
        };
        finalTests.push({
          ...template,
          term: termStr,
          raw_marks: template.raw_marks || 50
        });
      }
    }

    // Combine
    const combined = [...nonTests, ...finalTests];

    // Step 3: Assign terms for non-test assessments
    const termCounts = { '1': 0, '2': 0, '3': 0, '4': 0 };
    const result = [];

    for (const assessment of combined) {
      let assignedTerm = assessment.term;

      if (!assignedTerm) {
        const typical = TERM_DISTRIBUTION[assessment.assessment_type] || ['1'];

        let bestTerm = typical[0];
        let minCount = Infinity;
        for (const t of typical) {
          const count = termCounts[t] || 0;
          if (count < minCount) {
            minCount = count;
            bestTerm = t;
          }
        }
        assignedTerm = bestTerm;
      }

      termCounts[assignedTerm] = (termCounts[assignedTerm] || 0) + 1;

      result.push({
        assessment_type: assessment.assessment_type,
        term: assignedTerm,
        raw_marks: assessment.raw_marks || 0,
        converted_weight: null,
        is_examination: assessment.is_examination,
        is_formal: assessment.is_formal,
        is_practical: assessment.is_practical,
        is_compulsory: assessment.is_compulsory
      });
    }

    return result;
  }

  _extractPaperStructure(gradeBlock) {
    const papers = [];
    const lines = gradeBlock.split('\n');

    // Find the "4.5 End-of-year" or paper structure section
    let inPaperSection = false;
    let paperSectionStart = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/4\.5\s+End-of-year|Paper\s+1/i)) {
        inPaperSection = true;
        paperSectionStart = i;
        break;
      }
    }

    if (!inPaperSection) return papers;

    // Extract papers from the paper section
    const paperSection = lines.slice(paperSectionStart, Math.min(paperSectionStart + 50, lines.length)).join('\n');

    // Find all "Paper N" mentions
    const paperMatches = [...paperSection.matchAll(/Paper\s+(\d)/gi)];

    for (const match of paperMatches) {
      const paperNum = parseInt(match[1]);
      const idx = match.index;
      const context = paperSection.substring(Math.max(0, idx - 100), Math.min(paperSection.length, idx + 300));

      let duration = null;
      const durationMatch = context.match(PATTERNS.duration);
      if (durationMatch) {
        duration = durationMatch[1].replace('Â½', '.5').replace('/', '.');
      }

      let marks = null;
      const marksMatches = context.match(/(\d{2,3})\s*marks?/gi);
      if (marksMatches && marksMatches.length > 0) {
        const allMarks = marksMatches.map(m => parseInt(m.match(/\d+/)[0]));
        marks = Math.max(...allMarks);
      }

      const topics = this._extractTopicsFromContext(context);

      papers.push({
        paper_number: paperNum,
        duration_hours: duration ? parseFloat(duration) : null,
        total_marks: marks,
        topics_covered: topics,
        is_end_of_year: true
      });
    }

    // Deduplicate by paper number
    const deduped = {};
    for (const paper of papers) {
      const key = paper.paper_number;
      if (!deduped[key] || (paper.total_marks && !deduped[key].total_marks)) {
        deduped[key] = paper;
      }
    }

    return Object.values(deduped);
  }

  _extractTopicsFromContext(context) {
    const topics = [];
    const topicMatches = context.match(/[â€¢\-]\s*([^â€¢\-\n]+)/g);
    if (topicMatches) {
      for (const tm of topicMatches) {
        const clean = tm.replace(/[â€¢\-]/, '').trim();
        if (clean.length > 3 && clean.length < 100 && !clean.includes('Term') && !clean.includes('Grade')) {
          topics.push(clean);
        }
      }
    }
    return topics;
  }
}

const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

router.post('/api/caps/parse-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const parser = new CapsPdfParser();
    const result = await parser.parse(req.file.path);

    fs.unlinkSync(req.file.path);

    const totalAssessments = result.grades.reduce((sum, g) => sum + g.assessments.length, 0);
    const totalPapers = result.grades.reduce((sum, g) => sum + g.papers.length, 0);
    const warnings = [];

    if (!result.subject_name) warnings.push('Subject name not detected');
    if (result.grades.length === 0) warnings.push('No grade blocks found');
    if (totalAssessments === 0) warnings.push('No assessments extracted');

    for (const grade of result.grades) {
      const uniqueTerms = new Set(grade.assessments.map(a => a.term)).size;
      if (uniqueTerms < 4) {
        warnings.push(`Grade ${grade.grade_value}: Only ${uniqueTerms} unique terms found`);
      }
    }

    res.json({
      success: true,
      parsed: result,
      validation: {
        subject_detected: !!result.subject_name,
        grades_found: result.grades.length,
        total_assessments: totalAssessments,
        total_papers: totalPapers,
        warnings: warnings
      }
    });
  } catch (err) {
    console.error('CAPS PDF Parse Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/caps/seed-assessment', async (req, res) => {
  const { parsed_data } = req.body;
  const db = req.app.locals.db;

  if (!db) {
    return res.status(500).json({ error: 'Database not available' });
  }

  try {
    const results = {
      inserted: 0,
      errors: [],
      warnings: []
    };

    let subjectCode = parsed_data.subject_official_code;
    if (!subjectCode) {
      const [subjectRows] = await db.execute(
        'SELECT subject_official_code FROM lookup_subjects WHERE UPPER(subject_name) = UPPER(?)',
        [parsed_data.subject_name]
      );
      if (subjectRows.length > 0) {
        subjectCode = subjectRows[0].subject_official_code;
      } else {
        results.warnings.push(`Subject "${parsed_data.subject_name}" not found in lookup_subjects`);
        subjectCode = 'UNKNOWN';
      }
    }

    const gradeIdMap = { 10: 1, 11: 2, 12: 3 };

    for (const grade of parsed_data.grades) {
      const gradeId = gradeIdMap[grade.grade_value];
      if (!gradeId) {
        results.errors.push(`Invalid grade: ${grade.grade_value}`);
        continue;
      }

      for (const assessment of grade.assessments) {
        try {
          const assessmentName = assessment.assessment_type
            .replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());

          const [insertResult] = await db.execute(
            `INSERT INTO assessment_programme 
             (subject_official_code, grade_id, assessment_type, assessment_name, term, 
              weighting_percent, total_marks, duration_hours, paper_number,
              is_examination, is_formal, is_practical, is_compulsory, 
              source_document, extracted_at, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
              subjectCode,
              gradeId,
              assessment.assessment_type.toUpperCase().replace(/\s/g, '_'),
              assessmentName,
              assessment.term,
              0,
              assessment.raw_marks || 0,
              null,
              null,
              assessment.is_examination ? 1 : 0,
              assessment.is_formal ? 1 : 0,
              assessment.is_practical ? 1 : 0,
              assessment.is_compulsory ? 1 : 0,
              parsed_data.source_document,
              new Date(parsed_data.extracted_at)
            ]
          );
          results.inserted++;
        } catch (err) {
          results.errors.push(`Grade ${grade.grade_value}, ${assessment.assessment_type}: ${err.message}`);
        }
      }
    }

    res.json({
      success: true,
      seeded: results.inserted,
      warnings: results.warnings,
      errors: results.errors
    });
  } catch (err) {
    console.error('Seed Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==================== CAPS REVIEW DASHBOARD CRUD ROUTES ====================

router.get('/api/caps/assessment-programme/:subject_code', async (req, res) => {
  const db = req.app.locals.db;
  const { subject_code } = req.params;
  try {
    const [rows] = await db.execute(
      `SELECT * FROM assessment_programme WHERE subject_official_code = ? AND is_active = 1 ORDER BY grade_id, term, assessment_type`,
      [subject_code]
    );
    const gradeIdMap = { 1: 10, 2: 11, 3: 12 };
    const weightings = {
      1: { sba: 25, exam: 75, external: null, trial: null },
      2: { sba: 25, exam: 75, external: null, trial: null },
      3: { sba: 25, exam: null, external: 50, trial: 25 },
    };
    const grades = [1, 2, 3].map(gid => {
      const gradeAssessments = rows.filter(r => r.grade_id === gid);
      const w = weightings[gid];
      return {
        grade_value: gradeIdMap[gid],
        sba_weighting: w.sba,
        exam_weighting: w.exam,
        external_weighting: w.external,
        trial_weighting: w.trial,
        assessments: gradeAssessments
      };
    });
    const [subjectRows] = await db.execute(
      'SELECT subject_name FROM lookup_subjects WHERE subject_official_code = ?',
      [subject_code]
    );
    res.json({
      subject_name: subjectRows.length > 0 ? subjectRows[0].subject_name : subject_code,
      subject_official_code: subject_code,
      grades: grades.filter(g => g.assessments.length > 0)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/api/caps/assessment/:programme_id', async (req, res) => {
  const db = req.app.locals.db;
  const { programme_id } = req.params;
  try {
    const allowedFields = ['assessment_type', 'assessment_name', 'term', 'weighting_percent', 'total_marks', 'duration_hours', 'paper_number', 'description', 'is_examination', 'is_formal', 'is_practical', 'is_compulsory', 'covers_topics', 'cognitive_level_distribution'];
    const fields = [];
    const values = [];
    for (const [key, value] of Object.entries(req.body)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }
    if (fields.length === 0) return res.status(400).json({ error: 'No valid fields to update' });
    values.push(programme_id);
    await db.execute(`UPDATE assessment_programme SET ${fields.join(', ')} WHERE programme_id = ?`, values);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/caps/assessment/:subject_code/:grade_id', async (req, res) => {
  const db = req.app.locals.db;
  const { subject_code, grade_id } = req.params;
  try {
    const [result] = await db.execute(
      `INSERT INTO assessment_programme (subject_official_code, grade_id, assessment_type, assessment_name, term, weighting_percent, total_marks, duration_hours, paper_number, description, is_examination, is_formal, is_practical, is_compulsory, covers_topics, cognitive_level_distribution, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [subject_code, grade_id, req.body.assessment_type || 'test', req.body.assessment_name || 'New Assessment', req.body.term || '1', req.body.weighting_percent || 0, req.body.total_marks || 50, req.body.duration_hours || null, req.body.paper_number || null, req.body.description || null, req.body.is_examination ? 1 : 0, req.body.is_formal !== undefined ? (req.body.is_formal ? 1 : 0) : 1, req.body.is_practical ? 1 : 0, req.body.is_compulsory !== undefined ? (req.body.is_compulsory ? 1 : 0) : 1, req.body.covers_topics || null, req.body.cognitive_level_distribution || null, 1]
    );
    res.json({ success: true, programme_id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/api/caps/assessment/:programme_id', async (req, res) => {
  const db = req.app.locals.db;
  const { programme_id } = req.params;
  try {
    await db.execute('UPDATE assessment_programme SET is_active = 0 WHERE programme_id = ?', [programme_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
module.exports = { router, CapsPdfParser };


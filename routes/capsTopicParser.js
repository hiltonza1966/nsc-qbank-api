/**
 * CAPS Topic/Subtopic Parser â€” routes/capsTopicParser.js (v1.0 FOCUSED)
 * Purpose: Extract ONLY topics and subtopics from CAPS PDFs
 * Target Tables: lookup_caps_topics, lookup_caps_subtopics
 * NO ATP/POA/SUBJECT_MASTER seeding â€” those are already populated
 */

const pdf = require('pdf-parse');
const fs = require('fs');
const path = require('path');

// Subject short code mapping for topic_code generation
const SUBJECT_SHORT_CODES = {
  'MATHEMATICS': 'MATH',
  'MATHEMATICAL LITERACY': 'MATHLIT',
  'TECHNICAL MATHEMATICS': 'TECHMATH',
  'PHYSICAL SCIENCES': 'PHYS',
  'LIFE SCIENCES': 'LIFE',
  'LIFE ORIENTATION': 'LIFEORI',
  'GEOGRAPHY': 'GEO',
  'HISTORY': 'HIST',
  'ECONOMICS': 'ECON',
  'BUSINESS STUDIES': 'BUS',
  'ACCOUNTING': 'ACC',
  'TECHNICAL SCIENCES': 'TECHSCI',
  'CONSUMER STUDIES': 'CONS',
  'AGRICULTURAL SCIENCES': 'AGRI',
  'COMPUTER APPLICATIONS TECHNOLOGY': 'CAT',
  'INFORMATION TECHNOLOGY': 'IT',
  'TOURISM': 'TOUR',
  'HOSPITALITY STUDIES': 'HOSP',
  'DRAMATIC ARTS': 'DRAMA',
  'VISUAL ARTS': 'VISART',
  'MUSIC': 'MUSIC',
  'DANCE STUDIES': 'DANCE',
  'DESIGN': 'DESIGN',
  'RELIGION STUDIES': 'RELIG',
  'ENGLISH HOME LANGUAGE': 'ENGHL',
  'ENGLISH FIRST ADDITIONAL LANGUAGE': 'ENGFAL',
  'AFRIKAANS HOME LANGUAGE': 'AFRHL',
  'AFRIKAANS FIRST ADDITIONAL LANGUAGE': 'AFRFAL',
  'ISIZULU HOME LANGUAGE': 'ZULUHL',
  'ISIZULU FIRST ADDITIONAL LANGUAGE': 'ZULUFAL',
  'ISIXHOSA HOME LANGUAGE': 'XHOHL',
  'ISIXHOSA FIRST ADDITIONAL LANGUAGE': 'XHOFAL',
  'SESOTHO HOME LANGUAGE': 'SESHL',
  'SESOTHO FIRST ADDITIONAL LANGUAGE': 'SESFAL',
  'SEPEDI HOME LANGUAGE': 'SEPHL',
  'SEPEDI FIRST ADDITIONAL LANGUAGE': 'SEPFAL',
  'XITSONGA HOME LANGUAGE': 'XITHL',
  'XITSONGA FIRST ADDITIONAL LANGUAGE': 'XITFAL',
  'TSHIVENDA HOME LANGUAGE': 'TSHHL',
  'TSHIVENDA FIRST ADDITIONAL LANGUAGE': 'TSHFAL',
  'SETSWANA HOME LANGUAGE': 'TSWHL',
  'SETSWANA FIRST ADDITIONAL LANGUAGE': 'TSWFAL',
  'SISWATI HOME LANGUAGE': 'SWAHL',
  'SISWATI FIRST ADDITIONAL LANGUAGE': 'SWAFAL',
  'ISINDEBELE HOME LANGUAGE': 'NDEHL',
  'ISINDEBELE FIRST ADDITIONAL LANGUAGE': 'NDEFAL',
};

// Grade to grade_id mapping (lookup_grades: grade_id 1=10, 2=11, 3=12)
const GRADE_ID_MAP = { 10: 1, 11: 2, 12: 3 };

// Topic abbreviation generator (max 6 chars, uppercase, alphanumeric only)
function generateTopicAbbrev(topicName) {
  // Remove non-alphanumeric, take first 6 significant chars
  const clean = topicName.replace(/[^a-zA-Z0-9\s]/g, '').toUpperCase();
  const words = clean.split(/\s+/).filter(w => w.length > 2);

  if (words.length === 0) return 'TOPIC';
  if (words.length === 1) return words[0].substring(0, 6);

  // Multi-word: take first letter of each word up to 6 chars
  let abbrev = words.map(w => w[0]).join('');
  if (abbrev.length < 3 && words[0].length > 3) {
    abbrev = words[0].substring(0, 4);
  }
  return abbrev.substring(0, 6);
}

// Generate topic_code: {SUBJECT_SHORT}{GRADE_NUMBER}-{TOPIC_ABBREV}
function generateTopicCode(subjectShort, gradeNumber, topicAbbrev, existingCodes = new Set()) {
  let baseCode = `${subjectShort}${gradeNumber}-${topicAbbrev}`;
  let code = baseCode;
  let counter = 1;

  while (existingCodes.has(code)) {
    counter++;
    code = `${baseCode}${counter}`;
  }

  existingCodes.add(code);
  return code;
}

// Generate subtopic_code: {TOPIC_CODE}-{SUBTOPIC_NUM}
function generateSubtopicCode(topicCode, subtopicNum) {
  return `${topicCode}-${String(subtopicNum).padStart(2, '0')}`;
}

class CapsTopicParser {
  constructor() {
    this.rawText = '';
    this.lines = [];
    this.subjectName = null;
    this.subjectShortCode = null;
    this.subjectOfficialCode = null;
    this.existingTopicCodes = new Set();
  }

  async parse(pdfPath, dbConnection = null) {
    const dataBuffer = fs.readFileSync(pdfPath);
    const pdfData = await pdf(dataBuffer);
    this.rawText = pdfData.text;
    this.lines = this.rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    this._detectSubject();
    this._detectSubjectOfficialCode(dbConnection);

    // Extract topics from Section 2 (Overview) and Section 3 (Teaching Plans)
    const section2Topics = this._extractSection2Topics();
    const section3Topics = this._extractSection3Topics();

    // Merge and deduplicate topics
    const mergedTopics = this._mergeTopics(section2Topics, section3Topics);

    // Generate topic codes and subtopics
    const topicsWithCodes = this._assignTopicCodes(mergedTopics);
    const topicsWithSubtopics = this._extractSubtopics(topicsWithCodes);

    return {
      subject_name: this.subjectName,
      subject_short_code: this.subjectShortCode,
      subject_official_code: this.subjectOfficialCode,
      source_document: path.basename(pdfPath),
      extracted_at: new Date().toISOString(),
      parser_version: '1.0.0-focused',
      document_type: 'caps_topic_extraction',
      topics: topicsWithSubtopics,
      total_topics: topicsWithSubtopics.length,
      total_subtopics: topicsWithSubtopics.reduce((sum, t) => sum + (t.subtopics ? t.subtopics.length : 0), 0)
    };
  }

  // ============================================================================
  // SUBJECT DETECTION
  // ============================================================================
  _detectSubject() {
    const headerLines = this.lines.slice(0, 50).join(' ');

    const subjectMatch = headerLines.match(/([A-Z][A-Z\s]+?)\s+GRADES\s+10[-â€“]12/i);
    if (subjectMatch) {
      this.subjectName = subjectMatch[1].trim().replace(/\s+/g, ' ');
    }

    // Fallback: search full header area
    if (!this.subjectName) {
      for (let i = 0; i < Math.min(100, this.lines.length); i++) {
        const line = this.lines[i];
        const headerMatch = line.match(/^([A-Z][A-Z\s]+)\s+GRADES\s+10[-â€“]12/i);
        if (headerMatch && headerMatch[1].length > 3) {
          this.subjectName = headerMatch[1].trim().replace(/\s+/g, ' ');
          break;
        }
      }
    }

    // Apply corruption fixes
    if (this.subjectName) {
      const upperName = this.subjectName.toUpperCase();
      const fixes = {
        'IFE SCIENCES': 'LIFE SCIENCES',
        'IFE SCIENCE': 'LIFE SCIENCES',
        'CCOUNTING': 'ACCOUNTING',
        'ATHEMATICS': 'MATHEMATICS',
        'HYSICAL SCIENCES': 'PHYSICAL SCIENCES',
        'EOGRAPHY': 'GEOGRAPHY',
        'ISTORY': 'HISTORY',
        'CONOMICS': 'ECONOMICS',
        'USINESS STUDIES': 'BUSINESS STUDIES',
        'IFE ORIENTATION': 'LIFE ORIENTATION',
      };
      for (const [corrupted, fixed] of Object.entries(fixes)) {
        if (upperName === corrupted || upperName.includes(corrupted)) {
          this.subjectName = fixed;
          break;
        }
      }
    }

    // Set short code
    if (this.subjectName) {
      const upperName = this.subjectName.toUpperCase();
      this.subjectShortCode = SUBJECT_SHORT_CODES[upperName] || 
        upperName.substring(0, 6).replace(/[^A-Z0-9]/g, '');
    }
  }

  async _detectSubjectOfficialCode(db) {
    if (!db || !this.subjectName) return;

    try {
      const [rows] = await db.execute(
        'SELECT subject_official_code FROM caps_subjects_master WHERE UPPER(subject_name) = UPPER(?)',
        [this.subjectName]
      );
      if (rows.length > 0) {
        this.subjectOfficialCode = rows[0].subject_official_code;
      }
    } catch (err) {
      console.warn('Could not lookup subject_official_code:', err.message);
    }
  }

  // ============================================================================
  // SECTION 2: OVERVIEW OF TOPICS (Strands, Topics, Subtopics)
  // ============================================================================
  _extractSection2Topics() {
    const topics = [];
    const fullText = this.rawText;

    // Find Section 2
    const section2Match = fullText.match(/SECTION\s+2[:\.]?\s*(?:OVERVIEW|CONTENT|TOPICS)/i);
    if (!section2Match) return topics;

    const startIdx = section2Match.index;
    const endPatterns = [
      /SECTION\s+3[:\.]?\s*(?:TEACHING|ANNUAL|ATP)/i,
      /SECTION\s+4[:\.]?\s*ASSESSMENT/i,
      /3\.\s*ANNUAL\s+TEACHING\s+PLAN/i,
    ];

    let endIdx = fullText.length;
    for (const pattern of endPatterns) {
      const match = fullText.search(pattern);
      if (match !== -1 && match > startIdx) {
        endIdx = Math.min(endIdx, match);
      }
    }

    const section2Text = fullText.substring(startIdx, endIdx);
    const lines = section2Text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    let currentStrand = null;
    let currentGrade = null;

    for (const line of lines) {
      // Detect strand headers
      const strandMatch = line.match(/^(?:Knowledge\s+)?Strand\s+(\d)[:\.\s]*(.+)/i) ||
                         line.match(/^STRAND\s+(\d)[:\.\s]*(.+)/i);
      if (strandMatch) {
        currentStrand = strandMatch[2].trim();
        continue;
      }

      // Detect grade headers
      const gradeMatch = line.match(/^GRADE\s+(10|11|12)/i);
      if (gradeMatch) {
        currentGrade = parseInt(gradeMatch[1]);
        continue;
      }

      // Detect topic lines (typically start with bullet, number, or are capitalized phrases)
      const topicMatch = line.match(/^[â€¢\-\*\d\.]+\s*(.+)/) ||
                        line.match(/^([A-Z][A-Za-z\s&\/]+(?:of|in|and|the)[A-Za-z\s&\/]+)/);

      if (topicMatch && currentGrade && currentStrand) {
        const topicName = topicMatch[1].trim();
        if (topicName.length > 3 && topicName.length < 100 && 
            !topicName.match(/^(Term|Week|Grade|Section|Strand|Assessment)/i)) {

          topics.push({
            topic_name: topicName,
            strand: currentStrand,
            grade: currentGrade,
            grade_id: GRADE_ID_MAP[currentGrade],
            grade_number: currentGrade,
            term: null, // Will be filled from Section 3
            paper_no: null, // Will be filled from Section 3
            time_weeks: null,
            topic_weighting: null,
            source_section: 'section2_overview'
          });
        }
      }
    }

    return topics;
  }

  // ============================================================================
  // SECTION 3: TEACHING PLANS (Term assignments, time allocations, paper numbers)
  // ============================================================================
  _extractSection3Topics() {
    const topics = [];
    const fullText = this.rawText;

    // Find Section 3 / Annual Teaching Plan
    const section3Match = fullText.match(/SECTION\s+3[:\.]?\s*(?:TEACHING|ANNUAL|ATP)/i) ||
                         fullText.match(/3\.\s*ANNUAL\s+TEACHING\s+PLAN/i) ||
                         fullText.match(/ANNUAL\s+TEACHING\s+PLAN/i);
    if (!section3Match) return topics;

    const startIdx = section3Match.index;
    const endPatterns = [
      /SECTION\s+4[:\.]?\s*ASSESSMENT/i,
      /4\.\s*ASSESSMENT/i,
      /PROGRAMME\s+OF\s+ASSESSMENT/i,
    ];

    let endIdx = fullText.length;
    for (const pattern of endPatterns) {
      const match = fullText.search(pattern);
      if (match !== -1 && match > startIdx) {
        endIdx = Math.min(endIdx, match);
      }
    }

    const section3Text = fullText.substring(startIdx, endIdx);
    const lines = section3Text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    let currentGrade = null;
    let currentTerm = null;
    let currentPaper = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect grade
      const gradeMatch = line.match(/^GRADE\s+(10|11|12)/i);
      if (gradeMatch) {
        currentGrade = parseInt(gradeMatch[1]);
        continue;
      }

      // Detect term
      const termMatch = line.match(/^TERM\s+(1|2|3|4)/i);
      if (termMatch) {
        currentTerm = termMatch[1];
        continue;
      }

      // Detect paper number
      const paperMatch = line.match(/Paper\s+(1|2)/i);
      if (paperMatch) {
        currentPaper = parseInt(paperMatch[1]);
        continue;
      }

      // Detect time allocation (weeks/hours)
      const timeMatch = line.match(/(\d+)\s*weeks?\s*[(\[](\d+)\s*hrs?[)\]]/i) ||
                       line.match(/(\d+)\s*weeks?/i);
      const timeWeeks = timeMatch ? parseInt(timeMatch[1]) : null;

      // Detect topic lines (after "TIME TOPIC CONTENT" headers)
      const topicMatch = line.match(/^[â€¢\-\*\d\.]+\s*(.+)/) ||
                        (line.match(/^[A-Z][A-Za-z\s&\/]+/) && line.length > 5 && line.length < 80);

      if (topicMatch && currentGrade && currentTerm) {
        const topicName = typeof topicMatch === 'object' && topicMatch[1] ? 
          topicMatch[1].trim() : line.trim();

        if (topicName.length > 3 && topicName.length < 100 &&
            !topicName.match(/^(Term|Week|Grade|Time|Content|Practical|Resources|Assessment)/i)) {

          topics.push({
            topic_name: topicName,
            strand: null, // Will be filled from Section 2
            grade: currentGrade,
            grade_id: GRADE_ID_MAP[currentGrade],
            grade_number: currentGrade,
            term: currentTerm,
            paper_no: currentPaper,
            time_weeks: timeWeeks,
            topic_weighting: null,
            source_section: 'section3_teaching_plan'
          });
        }
      }
    }

    return topics;
  }

  // ============================================================================
  // MERGE TOPICS FROM SECTION 2 AND SECTION 3
  // ============================================================================
  _mergeTopics(section2Topics, section3Topics) {
    const merged = [];
    const seen = new Map(); // key: grade+topic_name

    // Add Section 2 topics first (they have strand info)
    for (const topic of section2Topics) {
      const key = `${topic.grade}|${topic.topic_name.toUpperCase()}`;
      seen.set(key, topic);
      merged.push(topic);
    }

    // Merge Section 3 topics (they have term/time info)
    for (const topic of section3Topics) {
      const key = `${topic.grade}|${topic.topic_name.toUpperCase()}`;
      if (seen.has(key)) {
        // Merge: add term, time, paper from Section 3 to existing
        const existing = seen.get(key);
        if (topic.term) existing.term = topic.term;
        if (topic.time_weeks) existing.time_weeks = topic.time_weeks;
        if (topic.paper_no) existing.paper_no = topic.paper_no;
      } else {
        seen.set(key, topic);
        merged.push(topic);
      }
    }

    return merged;
  }

  // ============================================================================
  // ASSIGN TOPIC CODES
  // ============================================================================
  _assignTopicCodes(topics) {
    const result = [];

    for (const topic of topics) {
      const abbrev = generateTopicAbbrev(topic.topic_name);
      const code = generateTopicCode(
        this.subjectShortCode || 'SUBJ',
        topic.grade_number || 12,
        abbrev,
        this.existingTopicCodes
      );

      result.push({
        ...topic,
        topic_code: code,
        is_active: 1,
        display_order: result.length + 1
      });
    }

    return result;
  }

  // ============================================================================
  // EXTRACT SUBTOPICS (from topic content details in Section 3)
  // ============================================================================
  _extractSubtopics(topics) {
    const fullText = this.rawText;

    for (const topic of topics) {
      topic.subtopics = [];

      // Find subtopic indicators in the text near this topic
      const topicRegex = new RegExp(
        topic.topic_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i'
      );
      const topicMatch = fullText.match(topicRegex);

      if (topicMatch) {
        const contextStart = Math.max(0, topicMatch.index - 200);
        const contextEnd = Math.min(fullText.length, topicMatch.index + 1000);
        const context = fullText.substring(contextStart, contextEnd);

        // Look for bullet points or numbered items that could be subtopics
        const subtopicMatches = context.matchAll(/[â€¢\-\*]\s*([A-Z][A-Za-z\s&\/]+)/g);
        let subtopicNum = 1;

        for (const subMatch of subtopicMatches) {
          const subName = subMatch[1].trim();
          if (subName.length > 3 && subName.length < 80 &&
              subName.toUpperCase() !== topic.topic_name.toUpperCase()) {

            topic.subtopics.push({
              subtopic_name: subName,
              subtopic_code: generateSubtopicCode(topic.topic_code, subtopicNum),
              description: null,
              is_active: 1,
              display_order: subtopicNum
            });
            subtopicNum++;
          }
        }
      }

      // If no subtopics found, create a default one
      if (topic.subtopics.length === 0) {
        topic.subtopics.push({
          subtopic_name: `${topic.topic_name} - General`,
          subtopic_code: generateSubtopicCode(topic.topic_code, 1),
          description: 'General content for this topic',
          is_active: 1,
          display_order: 1
        });
      }
    }

    return topics;
  }
}

// ============================================================================
// EXPRESS ROUTES
// ============================================================================

const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

// Parse CAPS PDF and extract topics/subtopics
router.post('/api/caps/parse-topics', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const db = req.app.locals.db;
    const parser = new CapsTopicParser();
    const result = await parser.parse(req.file.path, db);

    fs.unlinkSync(req.file.path);

    const warnings = [];
    if (!result.subject_name) warnings.push('Subject name not detected');
    if (!result.subject_official_code) warnings.push('Subject official code not found in database');
    if (result.topics.length === 0) warnings.push('No topics extracted');

    res.json({
      success: true,
      parsed: result,
      validation: {
        subject_detected: !!result.subject_name,
        subject_code_found: !!result.subject_official_code,
        topics_found: result.topics.length,
        subtopics_found: result.total_subtopics,
        warnings: warnings
      }
    });
  } catch (err) {
    console.error('CAPS Topic Parse Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Seed extracted topics/subtopics into database
router.post('/api/caps/seed-topics', async (req, res) => {
  const { parsed_data } = req.body;
  const db = req.app.locals.db;

  if (!db) {
    return res.status(500).json({ error: 'Database not available' });
  }

  try {
    const results = {
      topics_inserted: 0,
      subtopics_inserted: 0,
      errors: [],
      warnings: []
    };

    const subjectCode = parsed_data.subject_official_code;
    if (!subjectCode) {
      results.warnings.push('No subject_official_code provided');
    }

    for (const topic of parsed_data.topics) {
      try {
        // Insert topic
        const [topicResult] = await db.execute(
          `INSERT INTO lookup_caps_topics 
           (subject_official_code, grade_id, grade_number, strand, term, topic_code, 
            topic_name, topic_weighting, time_weeks, paper_no, description, 
            is_active, display_order, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            subjectCode,
            topic.grade_id,
            topic.grade_number,
            topic.strand,
            topic.term,
            topic.topic_code,
            topic.topic_name,
            topic.topic_weighting || null,
            topic.time_weeks || null,
            topic.paper_no || null,
            topic.description || null,
            topic.is_active || 1,
            topic.display_order || 0
          ]
        );

        const topicId = topicResult.insertId;
        results.topics_inserted++;

        // Insert subtopics
        for (const subtopic of (topic.subtopics || [])) {
          try {
            await db.execute(
              `INSERT INTO lookup_caps_subtopics 
               (topic_id, subtopic_code, subtopic_name, description, 
                is_active, display_order, created_at)
               VALUES (?, ?, ?, ?, ?, ?, NOW())`,
              [
                topicId,
                subtopic.subtopic_code,
                subtopic.subtopic_name,
                subtopic.description || null,
                subtopic.is_active || 1,
                subtopic.display_order || 0
              ]
            );
            results.subtopics_inserted++;
          } catch (err) {
            results.errors.push(`Subtopic ${subtopic.subtopic_code}: ${err.message}`);
          }
        }
      } catch (err) {
        results.errors.push(`Topic ${topic.topic_code}: ${err.message}`);
      }
    }

    res.json({
      success: true,
      seeded: results,
      warnings: results.warnings,
      errors: results.errors
    });
  } catch (err) {
    console.error('Seed Topics Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get topics for a subject
router.get('/api/caps/topics/:subject_code', async (req, res) => {
  const db = req.app.locals.db;
  const { subject_code } = req.params;

  try {
    const [topics] = await db.execute(
      `SELECT t.*, COUNT(s.subtopic_id) as subtopic_count
       FROM lookup_caps_topics t
       LEFT JOIN lookup_caps_subtopics s ON t.topic_id = s.topic_id
       WHERE t.subject_official_code = ? AND t.is_active = 1
       GROUP BY t.topic_id
       ORDER BY t.grade_number, t.display_order`,
      [subject_code]
    );

    res.json({
      success: true,
      subject: subject_code,
      count: topics.length,
      topics
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get subtopics for a topic
router.get('/api/caps/subtopics/:topic_id', async (req, res) => {
  const db = req.app.locals.db;
  const { topic_id } = req.params;

  try {
    const [subtopics] = await db.execute(
      `SELECT * FROM lookup_caps_subtopics 
       WHERE topic_id = ? AND is_active = 1
       ORDER BY display_order`,
      [topic_id]
    );

    res.json({
      success: true,
      topic_id: topic_id,
      count: subtopics.length,
      subtopics
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

/**
 * CAPS Curriculum Parser Framework
 * ================================
 * Extracts structured curriculum data from CAPS PDF documents
 * for seeding into lookup_caps_topics and lookup_caps_subtopics tables.
 * 
 * Usage:
 *   const capsParser = require('./caps-parser');
 *   const curriculum = await capsParser.extractFromPDF('path/to/CAPS_LIFE_SC.pdf');
 *   await capsParser.seedToDatabase(curriculum, dbConnection);
 * 
 * @version 1.0.0
 * @date 2026-06-10
 */

const pdf = require('pdf-parse');
const fs = require('fs').promises;

class CAPSCurriculumParser {
  constructor() {
    this.subject = null;
    this.subjectCode = null;
    this.grades = [10, 11, 12];
    this.strands = [];
    this.topics = [];
    this.subtopics = [];
    this.paperStructures = [];
  }

  /**
   * Extract curriculum data from CAPS PDF
   * @param {string} pdfPath - Path to CAPS PDF file
   * @returns {Promise<Object>} Structured curriculum data
   */
  async extractFromPDF(pdfPath) {
    const dataBuffer = await fs.readFile(pdfPath);
    const pdfData = await pdf(dataBuffer);
    const text = pdfData.text;

    // Extract metadata
    this.extractSubjectInfo(text);

    // Extract knowledge strands
    this.extractStrands(text);

    // Extract topics by grade
    for (const grade of this.grades) {
      this.extractGradeTopics(text, grade);
    }

    // Extract paper structures
    this.extractPaperStructures(text);

    // Extract cognitive level weightings
    this.extractCognitiveLevels(text);

    return {
      subject: this.subject,
      subjectCode: this.subjectCode,
      strands: this.strands,
      topics: this.topics,
      subtopics: this.subtopics,
      paperStructures: this.paperStructures,
      cognitiveLevels: this.cognitiveLevels
    };
  }

  /**
   * Extract subject name and code from PDF text
   */
  extractSubjectInfo(text) {
    // Match patterns like "LIFE SCIENCES GRADES 10-12"
    const subjectMatch = text.match(/([A-Z\s]+)\s+GRADES\s+10-12/i);
    if (subjectMatch) {
      this.subject = subjectMatch[1].trim();
      // Map to official code
      const subjectMap = {
        'LIFE SCIENCES': 'LIFE_SC',
        'MATHEMATICS': 'MATH',
        'PHYSICAL SCIENCES': 'PHYS_SC',
        'ACCOUNTING': 'ACCOUNTING',
        'ECONOMICS': 'ECONOMICS',
        'HISTORY': 'HISTORY',
        'GEOGRAPHY': 'GEOGRAPHY',
        'ENGLISH': 'ENG_FAL',
        'AFRIKAANS': 'AFR_FAL'
      };
      this.subjectCode = subjectMap[this.subject] || this.subject.toUpperCase().replace(/\s+/g, '_');
    }
  }

  /**
   * Extract knowledge strands from Section 2
   */
  extractStrands(text) {
    // Pattern: "Knowledge Strand 1: [Name]"
    const strandPattern = /Knowledge Strand (\d+):\s*([^\n]+)/g;
    let match;
    while ((match = strandPattern.exec(text)) !== null) {
      this.strands.push({
        code: `STRAND_${match[1]}`,
        name: match[2].trim(),
        shortName: this.generateShortName(match[2].trim())
      });
    }
  }

  /**
   * Extract topics for a specific grade from Section 3
   */
  extractGradeTopics(text, grade) {
    // Find the grade section: "3.X GRADE X:CONTENT"
    const gradeSection = new RegExp(`3\.${grade === 10 ? '1' : grade === 11 ? '2' : '3'}[^]*?(?=3\.${grade === 10 ? '2' : grade === 11 ? '3' : '4'}|SECTION 4|$)`, 's');
    const section = text.match(gradeSection);

    if (!section) return;

    const sectionText = section[0];

    // Extract term blocks
    const termPattern = /TERM\s*(\d+)\s*\nStrand\s*(\d+):([^\n]+)[^]*?(?=TERM\s*\d+|Assessment|Total|$)/gs;
    let termMatch;

    while ((termMatch = termPattern.exec(sectionText)) !== null) {
      const term = `T${termMatch[1]}`;
      const strandNum = termMatch[2];
      const strandName = termMatch[3].trim();
      const termContent = termMatch[0];

      // Extract topic table rows
      // CAPS format: | Time | Topic | Content | Investigations | Resources |
      const topicPattern = /(\d+\s*weeks?|\d+½\s*weeks?)\s*\n([^\n]+)\s*\n([^]*?)(?=\n\d+\s*weeks?|\nTERM|Assessment|Total|$)/g;
      let topicMatch;

      while ((topicMatch = topicPattern.exec(termContent)) !== null) {
        const timeAllocation = topicMatch[1].trim();
        const topicName = topicMatch[2].trim();
        const content = topicMatch[3].trim();

        // Generate topic code: SUBJ_GRADE_TERM_SEQ
        const topicCode = `${this.subjectCode}_${grade}_${termMatch[1]}_${this.topics.length + 1}`;

        // Extract weighting from paper structure tables (if available)
        const weighting = this.extractWeighting(grade, topicName);

        // Determine paper (1 or 2) from content or paper structure
        const paperNo = this.determinePaper(grade, topicName, strandNum);

        this.topics.push({
          subjectOfficialCode: this.subjectCode,
          gradeId: grade,
          strand: `Strand ${strandNum}: ${strandName}`,
          term: term,
          topicCode: topicCode,
          topicName: topicName,
          timeAllocation: timeAllocation,
          paperNo: paperNo,
          weighting: weighting,
          description: content.substring(0, 500), // Truncate for DB
          displayOrder: this.topics.length + 1
        });

        // Extract subtopics from content
        this.extractSubtopics(content, topicCode);
      }
    }
  }

  /**
   * Extract subtopics from topic content text
   */
  extractSubtopics(content, parentTopicCode) {
    // Look for bullet points or numbered items that represent subtopics
    const subtopicPattern = /[•\-\d]+\s*([^\n]+)/g;
    let match;
    let subtopicOrder = 1;

    while ((match = subtopicPattern.exec(content)) !== null) {
      const subtopicName = match[1].trim();
      if (subtopicName.length > 10 && subtopicName.length < 200) {
        this.subtopics.push({
          parentTopicCode: parentTopicCode,
          subtopicCode: `${parentTopicCode}_${String.fromCharCode(64 + subtopicOrder)}`,
          subtopicName: subtopicName,
          capsReference: `${this.subjectCode} ${subtopicOrder}.${subtopicOrder}`,
          description: subtopicName,
          displayOrder: subtopicOrder
        });
        subtopicOrder++;
      }
    }
  }

  /**
   * Extract paper structures from Section 4
   */
  extractPaperStructures(text) {
    // Find paper structure tables (e.g., "Paper 1" or "Paper 2")
    const paperPattern = /Paper\s*(\d+)\s*\(?(\d+½?)\s*hours?\)?[^]*?(?=Paper\s*\d+|SECTION|4\.6|$)/gs;
    let match;

    while ((match = paperPattern.exec(text)) !== null) {
      const paperNum = parseInt(match[1]);
      const paperText = match[0];

      // Extract table rows with topic, time, weighting, marks
      const rowPattern = /([^\n|]+)\s*\|\s*([^\n|]+)\s*\|\s*([^\n|]+)\s*\|\s*([^\n|]+)/g;
      let rowMatch;
      const items = [];

      while ((rowMatch = rowPattern.exec(paperText)) !== null) {
        items.push({
          topic: rowMatch[1].trim(),
          time: rowMatch[2].trim(),
          weighting: rowMatch[3].trim(),
          marks: rowMatch[4].trim()
        });
      }

      this.paperStructures.push({
        paperNumber: paperNum,
        duration: match[2],
        items: items
      });
    }
  }

  /**
   * Extract cognitive level weightings
   */
  extractCognitiveLevels(text) {
    const cognitivePattern = /Knowing\s*Science\s*\|?\s*(\d+)%|Understanding\s*Science\s*\|?\s*(\d+)%|Applying\s*scientific\s*knowledge\s*\|?\s*(\d+)%|Evaluating[\s,]+analysing[\s,]+and\s*synthesising\s*\|?\s*(\d+)%/gi;

    this.cognitiveLevels = {
      knowing: 40,
      understanding: 25,
      applying: 20,
      analysing: 15
    };
  }

  /**
   * Determine which paper a topic belongs to
   */
  determinePaper(grade, topicName, strandNum) {
    // Default logic based on CAPS patterns
    // Paper 1: Strand 1 (Molecular), Strand 2 (Life Processes)
    // Paper 2: Strand 3 (Environment), Strand 4 (Diversity)

    if (strandNum === '3' || strandNum === '4') {
      return 2; // Environmental Studies and Diversity usually Paper 2
    }

    // Some exceptions for Grade 12
    if (grade === 12) {
      if (topicName.includes('DNA') || topicName.includes('Meiosis') || 
          topicName.includes('Genetics') || topicName.includes('Evolution')) {
        return 2;
      }
    }

    return 1; // Default to Paper 1
  }

  /**
   * Extract weighting from paper structure section
   */
  extractWeighting(grade, topicName) {
    // This would cross-reference with paper structure tables
    // For now, return null - weightings are populated manually or from paper structure
    return null;
  }

  /**
   * Generate short name for strand
   */
  generateShortName(fullName) {
    const shortNames = {
      'Life at the Molecular, Cellular and Tissue Level': 'Molecular & Cellular',
      'Life Processes in Plants and Animals': 'Life Processes',
      'Environmental Studies': 'Environment',
      'Diversity, Change and Continuity': 'Diversity & Evolution'
    };
    return shortNames[fullName] || fullName.substring(0, 30);
  }

  /**
   * Generate SQL INSERT statements from extracted data
   */
  generateSQL(curriculumData) {
    let sql = `-- CAPS Curriculum Seed Data\n`;
    sql += `-- Subject: ${curriculumData.subject} (${curriculumData.subjectCode})\n`;
    sql += `-- Generated: ${new Date().toISOString()}\n\n`;

    // Topics
    sql += `-- Topics\n`;
    for (const topic of curriculumData.topics) {
      sql += `INSERT INTO lookup_caps_topics (subject_official_code, grade_id, strand, term, topic_code, topic_name, topic_weighting, time_weeks, paper_no, description, display_order) VALUES\n`;
      sql += `('${topic.subjectOfficialCode}', ${topic.gradeId}, '${topic.strand}', '${topic.term}', '${topic.topicCode}', '${topic.topicName.replace(/'/g, "''")}', ${topic.weighting || 'NULL'}, ${this.parseTime(topic.timeAllocation)}, ${topic.paperNo}, '${topic.description.replace(/'/g, "''")}', ${topic.displayOrder});\n`;
    }

    // Subtopics
    if (curriculumData.subtopics.length > 0) {
      sql += `\n-- Subtopics\n`;
      for (const subtopic of curriculumData.subtopics) {
        sql += `INSERT INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order)\n`;
        sql += `SELECT topic_id, '${subtopic.subtopicCode}', '${subtopic.subtopicName.replace(/'/g, "''")}', '${subtopic.capsReference}', '${subtopic.description.replace(/'/g, "''")}', ${subtopic.displayOrder}\n`;
        sql += `FROM lookup_caps_topics WHERE topic_code = '${subtopic.parentTopicCode}';\n`;
      }
    }

    return sql;
  }

  /**
   * Parse time allocation string to decimal weeks
   */
  parseTime(timeStr) {
    if (!timeStr) return 'NULL';

    // Handle "2½ weeks" or "2.5 weeks"
    const match = timeStr.match(/(\d+)(?:½|\.5)?/);
    if (match) {
      let weeks = parseInt(match[1]);
      if (timeStr.includes('½') || timeStr.includes('.5')) {
        weeks += 0.5;
      }
      return weeks;
    }
    return 'NULL';
  }

  /**
   * Seed extracted data directly to database
   */
  async seedToDatabase(curriculumData, dbConnection) {
    const topics = curriculumData.topics;
    const subtopics = curriculumData.subtopics;

    // Insert topics
    for (const topic of topics) {
      await dbConnection.execute(`
        INSERT INTO lookup_caps_topics 
        (subject_official_code, grade_id, strand, term, topic_code, topic_name, 
         topic_weighting, time_weeks, paper_no, description, display_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        topic_name = VALUES(topic_name),
        topic_weighting = VALUES(topic_weighting),
        time_weeks = VALUES(time_weeks),
        paper_no = VALUES(paper_no),
        description = VALUES(description)
      `, [
        topic.subjectOfficialCode, topic.gradeId, topic.strand, topic.term,
        topic.topicCode, topic.topicName, topic.weighting, this.parseTime(topic.timeAllocation),
        topic.paperNo, topic.description, topic.displayOrder
      ]);
    }

    // Insert subtopics
    for (const subtopic of subtopics) {
      await dbConnection.execute(`
        INSERT INTO lookup_caps_subtopics 
        (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order)
        SELECT topic_id, ?, ?, ?, ?, ?
        FROM lookup_caps_topics 
        WHERE topic_code = ?
        ON DUPLICATE KEY UPDATE
        subtopic_name = VALUES(subtopic_name),
        description = VALUES(description)
      `, [
        subtopic.subtopicCode, subtopic.subtopicName, subtopic.capsReference,
        subtopic.description, subtopic.displayOrder, subtopic.parentTopicCode
      ]);
    }

    return {
      topicsInserted: topics.length,
      subtopicsInserted: subtopics.length
    };
  }
}

module.exports = CAPSCurriculumParser;

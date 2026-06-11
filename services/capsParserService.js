// services/capsParserService.js
const fs = require('fs');
const path = require('path');

class CAPSParserService {
  constructor() {
    this.validationErrors = [];
    this.warnings = [];
  }

  async parseAndGenerateSQL(capsData, db) {
    this.validationErrors = [];
    this.warnings = [];

    const structureValid = this.validateStructure(capsData);
    if (!structureValid) {
      return {
        success: false,
        sql: '',
        validationReport: this.getValidationReport(),
        canExecute: false
      };
    }

    const dbValid = await this.validateAgainstDatabase(capsData, db);
    if (!dbValid) {
      return {
        success: false,
        sql: '',
        validationReport: this.getValidationReport(),
        canExecute: false
      };
    }

    const dupCheck = await this.checkDuplicates(capsData, db);
    if (!dupCheck.clean) {
      this.warnings.push(...dupCheck.warnings);
    }

    const sql = this.generateMigrationSQL(capsData);
    const syntaxValid = this.validateSQLSyntax(sql);

    return {
      success: syntaxValid && this.validationErrors.length === 0,
      sql: sql,
      validationReport: this.getValidationReport(),
      canExecute: syntaxValid && this.validationErrors.length === 0,
      warnings: this.warnings
    };
  }

  validateStructure(capsData) {
    const required = ['subject_official_code', 'subject_name', 'grades'];
    for (const field of required) {
      if (!capsData[field]) {
        this.validationErrors.push('Missing required field: ' + field);
      }
    }

    if (!capsData.grades || !Array.isArray(capsData.grades) || capsData.grades.length === 0) {
      this.validationErrors.push('grades array is required and must not be empty');
      return false;
    }

    for (const grade of capsData.grades) {
      if (!grade.grade_id) {
        this.validationErrors.push('Each grade must have a grade_id');
      }
      if (!grade.assessments || !Array.isArray(grade.assessments)) {
        this.validationErrors.push('Grade ' + grade.grade_id + ': assessments array required');
      }
      if (!grade.papers || !Array.isArray(grade.papers)) {
        this.validationErrors.push('Grade ' + grade.grade_id + ': papers array required');
      }
    }

    return this.validationErrors.length === 0;
  }

  async validateAgainstDatabase(capsData, db) {
    try {
      const [subjectRows] = await db.query(
        'SELECT subject_official_code, subject_name FROM lookup_subjects WHERE subject_official_code = ?',
        [capsData.subject_official_code]
      );

      if (subjectRows.length === 0) {
        this.validationErrors.push(
          'Subject ' + capsData.subject_official_code + ' not found in lookup_subjects'
        );
      } else if (subjectRows[0].subject_name !== capsData.subject_name) {
        this.warnings.push(
          'Subject name mismatch: CAPS says ' + capsData.subject_name + ', database has ' + subjectRows[0].subject_name
        );
      }

      for (const grade of capsData.grades) {
        const [gradeRows] = await db.query(
          'SELECT grade_id, grade_value FROM lookup_grades WHERE grade_id = ?',
          [grade.grade_id]
        );

        if (gradeRows.length === 0) {
          this.validationErrors.push(
            'Grade ID ' + grade.grade_id + ' not found in lookup_grades'
          );
        }
      }

      return this.validationErrors.length === 0;
    } catch (error) {
      this.validationErrors.push('Database validation error: ' + error.message);
      return false;
    }
  }

  async checkDuplicates(capsData, db) {
    const warnings = [];

    try {
      for (const grade of capsData.grades) {
        const [existing] = await db.query(
          'SELECT COUNT(*) as cnt FROM assessment_programme WHERE subject_official_code = ? AND grade_id = ?',
          [capsData.subject_official_code, grade.grade_id]
        );

        if (existing[0].cnt > 0) {
          warnings.push(
            'Grade ' + grade.grade_id + ' already has ' + existing[0].cnt + ' assessment(s). Migration will use DELETE + INSERT.'
          );
        }
      }
    } catch (error) {
      warnings.push('Duplicate check warning: ' + error.message);
    }

    return { clean: warnings.length === 0, warnings };
  }

  generateMigrationSQL(capsData) {
    console.log('=== generateMigrationSQL START ===');
    console.log('Input grades count: ' + capsData.grades.length);

    // Deduplicate assessments: same grade+term+type = keep only first
    const dedupedData = JSON.parse(JSON.stringify(capsData));
    console.log('After deep clone, dedupedData grades: ' + dedupedData.grades.length);

    for (const grade of dedupedData.grades) {
      if (grade.assessments && Array.isArray(grade.assessments)) {
        const originalCount = grade.assessments.length;
        const seen = new Set();
        const removed = [];

        grade.assessments = grade.assessments.filter((a, index) => {
          const type = (a.assessment_type || 'test').toLowerCase().trim();
          const term = (a.term || '1').toString().trim();
          const key = (grade.grade_id || grade.grade_value || '0') + '-' + term + '-' + type;

          if (seen.has(key)) {
            removed.push({ index: index, key: key, type: type, term: term, name: a.assessment_name });
            return false;
          }
          seen.add(key);
          return true;
        });

        console.log('Grade ' + (grade.grade_value || grade.grade_id) + ':');
        console.log('  Original: ' + originalCount + ' assessments');
        console.log('  After dedup: ' + grade.assessments.length + ' assessments');
        console.log('  Removed: ' + removed.length);
        if (removed.length > 0) {
          removed.forEach(function(r) {
            console.log('    - [' + r.key + '] ' + (r.name || 'unnamed'));
          });
        }
      }
    }

    const lines = [];
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const migrationNumber = this.generateMigrationNumber();

    lines.push('-- ============================================================');
    lines.push('-- MIGRATION: ' + migrationNumber + '_caps_' + capsData.subject_official_code + '.sql');
    lines.push('-- Date: ' + timestamp);
    lines.push('-- Subject: ' + capsData.subject_name + ' (' + capsData.subject_official_code + ')');
    lines.push('-- Generated by: CAPS Parse Wizard');
    lines.push('-- ============================================================');
    lines.push('');
    lines.push('SET FOREIGN_KEY_CHECKS = 0;');
    lines.push('');

    lines.push('-- Clear existing data for ' + capsData.subject_name);
    lines.push("DELETE FROM assessment_programme WHERE subject_official_code = '" + capsData.subject_official_code + "';");
    lines.push("DELETE FROM exam_construction_guidelines WHERE subject_official_code = '" + capsData.subject_official_code + "';");
    lines.push("DELETE FROM paper_section_structure WHERE subject_official_code = '" + capsData.subject_official_code + "';");
    lines.push('');

    lines.push('-- ============================================================');
    lines.push('-- PART 1: ASSESSMENT PROGRAMME');
    lines.push('-- ============================================================');
    lines.push('');

    console.log('=== SQL GENERATION ===');
    for (const grade of dedupedData.grades) {
      lines.push('-- Grade ' + (grade.grade_value || grade.grade_id) + ' (' + grade.grade_id + ')');
      console.log('Grade ' + (grade.grade_value || grade.grade_id) + ' generating ' + grade.assessments.length + ' INSERTs');

      for (const assessment of grade.assessments) {
        console.log('  INSERT: ' + (assessment.assessment_type || 'test') + ' | term=' + (assessment.term || '1') + ' | name=' + (assessment.assessment_name || 'unnamed'));
        // Apply defaults for missing fields
        const safeAssessment = {
          assessment_type: assessment.assessment_type || 'test',
          assessment_name: assessment.assessment_name || this.generateAssessmentName(assessment.assessment_type, assessment.term),
          term: assessment.term || '1',
          weighting_percent: assessment.weighting_percent !== undefined && assessment.weighting_percent !== null ? assessment.weighting_percent : 0,
          total_marks: assessment.total_marks !== undefined && assessment.total_marks !== null ? assessment.total_marks : 0,
          duration_hours: assessment.duration_hours || null,
          paper_number: assessment.paper_number || null,
          description: assessment.description || null,
          is_formal: assessment.is_formal !== false,
          is_examination: assessment.is_examination === true,
          is_practical: assessment.is_practical === true,
          is_compulsory: assessment.is_compulsory !== false,
          covers_topics: assessment.covers_topics || null,
          cognitive_level_distribution: assessment.cognitive_level_distribution || null,
          ...assessment
        };

        const fields = [];
        const values = [];

        fields.push('subject_official_code');
        values.push("'" + capsData.subject_official_code + "'");

        fields.push('grade_id');
        values.push(grade.grade_id);

        fields.push('assessment_type');
        values.push("'" + safeAssessment.assessment_type + "'");

        fields.push('assessment_name');
        values.push("'" + this.escapeSQL(safeAssessment.assessment_name) + "'");

        fields.push('term');
        values.push("'" + safeAssessment.term + "'");

        fields.push('weighting_percent');
        values.push(safeAssessment.weighting_percent);

        if (safeAssessment.total_marks !== undefined && safeAssessment.total_marks !== null) {
          fields.push('total_marks');
          values.push(safeAssessment.total_marks);
        }

        if (safeAssessment.duration_hours !== undefined && safeAssessment.duration_hours !== null) {
          fields.push('duration_hours');
          values.push(safeAssessment.duration_hours);
        }

        if (safeAssessment.paper_number !== undefined && safeAssessment.paper_number !== null) {
          fields.push('paper_number');
          values.push(safeAssessment.paper_number);
        }

        if (safeAssessment.description) {
          fields.push('description');
          values.push("'" + this.escapeSQL(safeAssessment.description) + "'");
        }

        fields.push('is_formal');
        values.push(safeAssessment.is_formal !== false ? 'TRUE' : 'FALSE');

        fields.push('is_examination');
        values.push(safeAssessment.is_examination === true ? 'TRUE' : 'FALSE');

        if (safeAssessment.is_practical !== undefined) {
          fields.push('is_practical');
          values.push(safeAssessment.is_practical === true ? 'TRUE' : 'FALSE');
        }

        fields.push('is_compulsory');
        values.push(safeAssessment.is_compulsory !== false ? 'TRUE' : 'FALSE');

        if (safeAssessment.covers_topics) {
          fields.push('covers_topics');
          values.push("'" + this.escapeSQL(safeAssessment.covers_topics) + "'");
        }

        if (safeAssessment.cognitive_level_distribution) {
          fields.push('cognitive_level_distribution');
          values.push("'" + safeAssessment.cognitive_level_distribution + "'");
        }

        lines.push('INSERT INTO assessment_programme (' + fields.join(', ') + ') VALUES (' + values.join(', ') + ');');
      }
      lines.push('');
    }

    lines.push('-- ============================================================');
    lines.push('-- PART 2: EXAM CONSTRUCTION GUIDELINES');
    lines.push('-- ============================================================');
    lines.push('');

    for (const grade of dedupedData.grades) {
      if (!grade.papers || !Array.isArray(grade.papers) || grade.papers.length === 0) {
        continue;
      }
      for (const paper of grade.papers) {
        const fields = [
          'subject_official_code', 'grade_id', 'paper_number', 'paper_name',
          'duration_hours', 'total_marks', 'total_items', 'sections_count',
          'lower_order_percent', 'middle_order_percent', 'higher_order_percent',
          'mcq_percent', 'short_answer_percent', 'long_answer_percent', 'problem_solving_percent',
          'topic_weighting_1', 'topic_weighting_2', 'topic_weighting_3',
          'must_cover_all_topics', 'must_include_calculations', 'must_include_theory',
          'instructions', 'marking_guidelines', 'special_requirements'
        ];

        const values = [
          "'" + capsData.subject_official_code + "'",
          grade.grade_id,
          paper.paper_number,
          "'" + this.escapeSQL(paper.paper_name) + "'",
          paper.duration_hours,
          paper.total_marks,
          paper.total_items || 25,
          paper.sections_count || 3,
          paper.lower_order_percent || 40.0,
          paper.middle_order_percent || 30.0,
          paper.higher_order_percent || 30.0,
          paper.mcq_percent || 10.0,
          paper.short_answer_percent || 45.0,
          paper.long_answer_percent || 35.0,
          paper.problem_solving_percent || 10.0,
          paper.topic_weighting_1 || 35.0,
          paper.topic_weighting_2 || 35.0,
          paper.topic_weighting_3 || 30.0,
          paper.must_cover_all_topics !== false ? 'TRUE' : 'FALSE',
          paper.must_include_calculations !== false ? 'TRUE' : 'FALSE',
          paper.must_include_theory !== false ? 'TRUE' : 'FALSE',
          "'" + this.escapeSQL(paper.instructions || 'Answer ALL questions.') + "'",
          "'" + this.escapeSQL(paper.marking_guidelines || 'Method marks awarded.') + "'",
          "'" + this.escapeSQL(paper.special_requirements || 'Non-programmable calculator permitted.') + "'"
        ];

        lines.push('INSERT INTO exam_construction_guidelines (' + fields.join(', ') + ') VALUES (' + values.join(', ') + ');');
      }
      lines.push('');
    }

    lines.push('-- ============================================================');
    lines.push('-- PART 3: PAPER SECTION STRUCTURE');
    lines.push('-- ============================================================');
    lines.push('');

    for (const grade of dedupedData.grades) {
      if (!grade.papers || !Array.isArray(grade.papers) || grade.papers.length === 0) {
        continue;
      }
      for (const paper of grade.papers) {
        if (!paper.sections || !Array.isArray(paper.sections) || paper.sections.length === 0) {
          continue;
        }
        for (const section of paper.sections) {
          const fields = [
            'subject_official_code', 'grade_id', 'paper_number', 'section_letter',
            'section_name', 'question_types', 'total_marks', 'total_items',
            'time_allocation_minutes', 'cognitive_level', 'must_answer_all', 'covers_topics'
          ];

          const values = [
            "'" + capsData.subject_official_code + "'",
            grade.grade_id,
            paper.paper_number,
            "'" + section.section_letter + "'",
            "'" + this.escapeSQL(section.section_name) + "'",
            "'" + this.escapeSQL(section.question_types) + "'",
            section.total_marks,
            section.total_items,
            section.time_allocation_minutes,
            "'" + (section.cognitive_level || 'mixed') + "'",
            section.must_answer_all !== false ? 'TRUE' : 'FALSE',
            "'" + this.escapeSQL(section.covers_topics || 'All topics') + "'"
          ];

          lines.push('INSERT INTO paper_section_structure (' + fields.join(', ') + ') VALUES (' + values.join(', ') + ');');
        }
        lines.push('');
      }
    }

    lines.push('-- ============================================================');
    lines.push('-- PART 4: VERIFICATION');
    lines.push('-- ============================================================');
    lines.push('');
    lines.push("SELECT '=== ASSESSMENT PROGRAMME ===' as status;");
    lines.push('SELECT grade_id, COUNT(*) as assessments, SUM(weighting_percent) as total_weighting');
    lines.push('FROM assessment_programme');
    lines.push("WHERE subject_official_code = '" + capsData.subject_official_code + "'");
    lines.push('GROUP BY grade_id;');
    lines.push('');
    lines.push("SELECT '=== EXAM GUIDELINES ===' as status;");
    lines.push('SELECT grade_id, paper_number, paper_name, duration_hours, total_marks');
    lines.push('FROM exam_construction_guidelines');
    lines.push("WHERE subject_official_code = '" + capsData.subject_official_code + "'");
    lines.push('ORDER BY grade_id, paper_number;');
    lines.push('');
    lines.push("SELECT '=== PAPER SECTIONS ===' as status;");
    lines.push('SELECT grade_id, paper_number, section_letter, section_name, total_marks, total_items');
    lines.push('FROM paper_section_structure');
    lines.push("WHERE subject_official_code = '" + capsData.subject_official_code + "'");
    lines.push('ORDER BY grade_id, paper_number, section_letter;');
    lines.push('');
    lines.push("SELECT '=== FINAL COUNTS ===' as status;");
    lines.push("SELECT 'assessment_programme' as tbl, COUNT(*) as cnt FROM assessment_programme WHERE subject_official_code = '" + capsData.subject_official_code + "'");
    lines.push('UNION ALL');
    lines.push("SELECT 'exam_construction_guidelines', COUNT(*) FROM exam_construction_guidelines WHERE subject_official_code = '" + capsData.subject_official_code + "'");
    lines.push('UNION ALL');
    lines.push("SELECT 'paper_section_structure', COUNT(*) FROM paper_section_structure WHERE subject_official_code = '" + capsData.subject_official_code + "';");
    lines.push('');
    lines.push('SET FOREIGN_KEY_CHECKS = 1;');
    lines.push('');
    lines.push('-- ============================================================');
    lines.push('-- END OF MIGRATION');
    lines.push('-- ============================================================');

    return lines.join('\n');
  }

  async executeSQL(sql, db) {
    try {
      console.log('=== executeSQL START ===');
      console.log('Total statements: ' + sql.split(';').filter(s => s.trim().length > 0).length);

      const statements = sql.split(';').filter(s => s.trim().length > 0);
      const results = [];

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        const trimmed = statement.trim();

        console.log('Statement ' + (i + 1) + '/' + statements.length + ': ' + trimmed.substring(0, 70));

        if (trimmed === '') {
          console.log('  -> SKIPPED (empty)');
          continue;
        }
        // Check if this is a pure comment line (no SQL after it)
        const lines = trimmed.split('\n');
        const hasSQL = lines.some(line => {
          const clean = line.trim();
          return clean.length > 0 && !clean.startsWith('--') && !clean.startsWith('/*');
        });
        if (!hasSQL) {
          console.log('  -> SKIPPED (pure comment)');
          continue;
        }
        // Strip comments to get the actual SQL for type checking
        const sqlLines = trimmed.split('\n').filter(line => {
          const clean = line.trim();
          return clean.length > 0 && !clean.startsWith('--') && !clean.startsWith('/*');
        });
        const sqlOnly = sqlLines.join(' ').trim();

        if (sqlOnly.startsWith('SET FOREIGN_KEY_CHECKS')) {
          console.log('  -> SET FOREIGN_KEY_CHECKS');
          try {
            await db.query(trimmed + ';');
            console.log('  -> OK');
          } catch (e) {
            console.log('  -> SET ERROR: ' + e.message);
            throw e;
          }
          continue;
        }
        if (sqlOnly.startsWith('SELECT')) {
          console.log('  -> SELECT');
          try {
            const [rows] = await db.query(trimmed + ';');
            results.push({ type: 'select', statement: trimmed.substring(0, 50), rows });
            console.log('  -> OK: ' + rows.length + ' rows');
          } catch (e) {
            console.log('  -> SELECT ERROR: ' + e.message);
            throw e;
          }
        } else if (sqlOnly.startsWith('DELETE')) {
          console.log('  -> DELETE');
          try {
            const [result] = await db.query(trimmed + ';');
            results.push({ type: 'modify', statement: trimmed.substring(0, 50), affectedRows: result.affectedRows });
            console.log('  -> OK: ' + result.affectedRows + ' rows deleted');
          } catch (e) {
            console.log('  -> DELETE ERROR: ' + e.message);
            throw e;
          }
        } else if (sqlOnly.startsWith('INSERT')) {
          console.log('  -> INSERT');
          try {
            const [result] = await db.query(trimmed + ';');
            results.push({ type: 'modify', statement: trimmed.substring(0, 50), affectedRows: result.affectedRows });
            console.log('  -> OK: ' + result.affectedRows + ' rows inserted');
          } catch (e) {
            console.log('  -> INSERT ERROR: ' + e.message);
            console.log('  -> Failing statement: ' + trimmed.substring(0, 120));
            throw e;
          }
        } else {
          console.log('  -> UNKNOWN: ' + sqlOnly.substring(0, 50));
        }
      }

      console.log('=== executeSQL END ===');
      console.log('All statements executed successfully');
      return { success: true, results };
    } catch (error) {
      console.log('=== executeSQL ERROR ===');
      console.log('Error: ' + error.message);
      console.log('SQL that failed: ' + sql.substring(0, 200));

      // Write error log to file
      const logDir = path.join(process.cwd(), 'logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      const logFile = path.join(logDir, 'sql_error_' + new Date().toISOString().slice(0, 10) + '.log');
      const logEntry = [
        '=== ' + new Date().toISOString() + ' ===',
        'ERROR: ' + error.message,
        'SQL (first 500 chars): ' + sql.substring(0, 500),
        '=== END ===',
        ''
      ].join('\n');
      fs.appendFileSync(logFile, logEntry, 'utf8');
      console.log('Error log written to: ' + logFile);

      return { success: false, error: error.message };
    }
  }

  async saveMigrationFile(sql, subjectCode) {
    const migrationsDir = path.join(process.cwd(), 'database', 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      fs.mkdirSync(migrationsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    const lastNum = files.length > 0 
      ? parseInt(files[files.length - 1].split('_')[0]) || 0 
      : 0;
    const nextNum = String(lastNum + 1).padStart(3, '0');

    const filename = nextNum + '_caps_' + subjectCode + '_' + timestamp + '.sql';
    const filepath = path.join(migrationsDir, filename);

    fs.writeFileSync(filepath, sql, 'utf8');
    return { filename, filepath };
  }

  generateMigrationNumber() {
    const migrationsDir = path.join(process.cwd(), 'database', 'migrations');
    if (!fs.existsSync(migrationsDir)) return '001';

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    const lastNum = files.length > 0 
      ? parseInt(files[files.length - 1].split('_')[0]) || 0 
      : 0;
    return String(lastNum + 1).padStart(3, '0');
  }

  generateAssessmentName(type, term) {
    if (!type) return 'Unnamed Assessment';
    const cleanType = type.replace(/_/g, ' ').replace(/\w/g, l => l.toUpperCase());
    return cleanType + ' (Term ' + (term || '1') + ')';
  }

  escapeSQL(str) {
    if (!str) return '';
    return str
      .replace(/'/g, "''")
      .replace(/\\/g, '\\')
      .replace(/\n/g, ' ')
      .replace(/\r/g, ' ')
      .trim();
  }

  validateSQLSyntax(sql) {
    const issues = [];

    const singleQuotes = (sql.match(/'/g) || []).length;
    if (singleQuotes % 2 !== 0) {
      issues.push('Unbalanced single quotes detected');
    }

    const requiredTables = ['assessment_programme', 'exam_construction_guidelines', 'paper_section_structure'];
    for (const table of requiredTables) {
      if (!sql.includes(table)) {
        issues.push('Missing table: ' + table);
      }
    }

    if (issues.length > 0) {
      this.validationErrors.push(...issues);
      return false;
    }

    return true;
  }

  getValidationReport() {
    return {
      errors: this.validationErrors,
      warnings: this.warnings,
      errorCount: this.validationErrors.length,
      warningCount: this.warnings.length,
      isValid: this.validationErrors.length === 0
    };
  }
}

module.exports = new CAPSParserService();

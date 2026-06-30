const express = require('express');
const router = express.Router();
const db = require('../backend/db');

// Helper: extract language suffix from paper_code (e.g., "ACCOUNTING_P1_2025_NOV_ENG" -> "ENG")
function extractLanguageSuffix(paperCode) {
  if (!paperCode || typeof paperCode !== 'string') return null;
  const parts = paperCode.split('_');
  if (parts.length < 2) return null;
  return parts[parts.length - 1].toUpperCase();
}

// Helper: map language suffix to lookup_languages language_code
// ENG->EN(1), AFR->AF(2), ZUL->ZU(3), XHO->XH(4), etc.
const SUFFIX_TO_LANG_CODE = {
  'ENG': 'EN',
  'AFR': 'AF',
  'ZUL': 'ZU',
  'XHO': 'XH',
  'SOT': 'ST',
  'TSW': 'TN',
  'SWA': 'NS',
  'NDE': 'ND',
  'TSO': 'TS',
  'VEN': 'VE'
};

// GET /api/dashboard/parser/parser-import-status
// Query params: year, grade, subject, paper, language
router.get('/parser-import-status', async (req, res) => {
  try {
    const { year, grade, subject, paper, language } = req.query;

    // Build WHERE clause for filters
    let whereClause = '';
    const params = [];

    if (year) {
      whereClause += ' AND ps.year_id = ?';
      params.push(year);
    }
    if (grade) {
      whereClause += ' AND ps.grade_id = ?';
      params.push(grade);
    }
    if (subject) {
      whereClause += ' AND ps.subject_id = ?';
      params.push(subject);
    }
    if (paper) {
      whereClause += ' AND ps.paper_id = ?';
      params.push(paper);
    }
    // Note: language filter applied post-query since parse_sessions has no language_id column

    // Get ALL parse_sessions with LEFT JOINs to show papers even with 0 parsed items
    const [parsedData] = await db.query(`
      SELECT
        ps.session_id,
        ps.paper_code,
        ps.year_id,
        ps.grade_id,
        ps.subject_id,
        ps.paper_id,
        ps.file_name,
        ps.status,
        ps.total_items_found,
        ps.total_marks_parser,
        ps.total_marks_expected,
        ps.total_marks_corrected,
        ps.auto_corrected_count,
        ps.manual_review_count,
        ps.missing_count,
        ps.completed_at,
        ps.created_at,
        s.subject_name,
        s.subject_official_code,
        s.subject_alpha_code,
        p.paper_no,
        p.paper_name,
        y.year_value,
        g.grade_number,
        COUNT(DISTINCT pr.result_id) as qp_items_parsed,
        COUNT(DISTINCT pm.memo_id) as memo_items_parsed,
        SUM(CASE WHEN pr.is_header = 1 THEN 1 ELSE 0 END) as headers_parsed
      FROM parse_sessions ps
      LEFT JOIN lookup_subjects s ON ps.subject_id = s.subject_id
      LEFT JOIN lookup_papers p ON ps.paper_id = p.paper_id
      LEFT JOIN lookup_years y ON ps.year_id = y.year_id
      LEFT JOIN lookup_grades g ON ps.grade_id = g.grade_id
      LEFT JOIN parse_results pr ON ps.session_id = pr.session_id AND pr.is_memo = 0
      LEFT JOIN parse_memos pm ON ps.session_id = pm.session_id
      WHERE 1=1 ${whereClause}
      GROUP BY ps.session_id, ps.paper_code, ps.year_id, ps.grade_id, ps.subject_id, ps.paper_id, ps.file_name, ps.status, ps.total_items_found, ps.total_marks_parser, ps.total_marks_expected, ps.total_marks_corrected, ps.auto_corrected_count, ps.manual_review_count, ps.missing_count, ps.completed_at, ps.created_at, s.subject_name, s.subject_official_code, s.subject_alpha_code, p.paper_no, p.paper_name, y.year_value, g.grade_number
      ORDER BY COALESCE(s.subject_name, ps.paper_code), p.paper_no, y.year_value
    `, params);

    // Get database data grouped by paper
    const [dbData] = await db.query(`
      SELECT
        im.source_paper_code,
        COUNT(DISTINCT im.item_id) as qp_items_db,
        COUNT(DISTINCT imemo.memo_id) as memo_items_db,
        CAST(SUM(CASE WHEN im.item_media_file IS NOT NULL AND im.item_media_file != '' THEN 1 ELSE 0 END) AS UNSIGNED) as attachments_db
      FROM item_master im
      LEFT JOIN item_memos imemo ON im.item_id = imemo.item_id
      WHERE im.source_paper_code IS NOT NULL
      GROUP BY im.source_paper_code
    `);

    // Create a map for DB data
    const dbMap = {};
    dbData.forEach(row => {
      dbMap[row.source_paper_code] = row;
    });

    // Pre-load languages for mapping
    const [langRows] = await db.query('SELECT language_id, language_code, language_name FROM lookup_languages ORDER BY language_id');
    const langByCode = {};
    langRows.forEach(l => { langByCode[l.language_code] = l; });

    // Combine parsed and DB data
    let result = parsedData.map(row => {
      const dbRow = dbMap[row.paper_code] || {};
      const qpParsed = parseInt(row.qp_items_parsed || 0, 10);
      const memoParsed = parseInt(row.memo_items_parsed || 0, 10);
      const qpDb = parseInt(dbRow.qp_items_db || 0, 10);
      const memoDb = parseInt(dbRow.memo_items_db || 0, 10);

      // Extract language from paper_code (last segment after last underscore)
      const langSuffix = extractLanguageSuffix(row.paper_code);
      const langCode = SUFFIX_TO_LANG_CODE[langSuffix] || langSuffix || 'UNK';
      const langInfo = langByCode[langCode] || { language_name: langSuffix || 'Unknown', language_id: null, language_code: langCode };

      // Determine import status
      let status = 'missing';
      if (qpDb > 0 || memoDb > 0) {
        if (qpDb >= qpParsed && memoDb >= memoParsed && qpParsed > 0) {
          status = 'complete';
        } else {
          status = 'partial';
        }
      } else if (qpParsed > 0 || memoParsed > 0) {
        status = 'parsed_not_imported';
      }

      return {
        paper_code: row.paper_code,
        session_id: row.session_id,
        subject_name: row.subject_name || 'Unknown Subject',
        subject_official_code: row.subject_official_code || 'N/A',
        subject_alpha_code: row.subject_alpha_code || 'N/A',
        paper_no: row.paper_no,
        paper_name: row.paper_name || 'Paper ' + (row.paper_no || '?'),
        year_value: row.year_value,
        grade_number: row.grade_number,
        language_name: langInfo.language_name,
        language_id: langInfo.language_id,
        language_code: langInfo.language_code,
        file_name: row.file_name,
        parser_status: row.status,
        parsed: {
          qp_items: qpParsed,
          memo_items: memoParsed,
          headers: parseInt(row.headers_parsed || 0, 10),
          total_items_found: parseInt(row.total_items_found || 0, 10),
          total_marks_parser: parseInt(row.total_marks_parser || 0, 10),
          total_marks_expected: parseInt(row.total_marks_expected || 0, 10),
          total_marks_corrected: parseInt(row.total_marks_corrected || 0, 10)
        },
        database: {
          qp_items: qpDb,
          memo_items: memoDb,
          attachments: parseInt(dbRow.attachments_db || 0, 10)
        },
        import_status: status
      };
    });

    // Apply language filter post-query if specified (filter by language_id)
    if (language) {
      const langId = parseInt(language, 10);
      result = result.filter(r => r.language_id === langId);
    }

    // Calculate summary
    const summary = {
      total_papers: result.length,
      complete: result.filter(r => r.import_status === 'complete').length,
      partial: result.filter(r => r.import_status === 'partial').length,
      missing: result.filter(r => r.import_status === 'missing').length,
      parsed_not_imported: result.filter(r => r.import_status === 'parsed_not_imported').length,
      total_parsed_qp: result.reduce((sum, r) => sum + r.parsed.qp_items, 0),
      total_parsed_memo: result.reduce((sum, r) => sum + r.parsed.memo_items, 0),
      total_db_qp: result.reduce((sum, r) => sum + r.database.qp_items, 0),
      total_db_memo: result.reduce((sum, r) => sum + r.database.memo_items, 0)
    };

    res.json({
      success: true,
      data: result,
      summary
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/dashboard/parser/filters
// Get available filter values from lookup tables
router.get('/filters', async (req, res) => {
  try {
    const [years] = await db.query('SELECT year_id, year_value FROM lookup_years ORDER BY year_value DESC');
    const [grades] = await db.query('SELECT grade_id, grade_number FROM lookup_grades ORDER BY grade_number');
    const [subjects] = await db.query('SELECT subject_id, subject_name, subject_official_code, subject_alpha_code FROM lookup_subjects ORDER BY subject_name');
    const [papers] = await db.query('SELECT paper_id, paper_no, paper_name FROM lookup_papers ORDER BY paper_no');
    const [languages] = await db.query('SELECT language_id, language_code, language_name FROM lookup_languages ORDER BY language_name');

    res.json({
      success: true,
      data: {
        years,
        grades,
        subjects,
        papers,
        languages
      }
    });
  } catch (err) {
    console.error('Filters error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

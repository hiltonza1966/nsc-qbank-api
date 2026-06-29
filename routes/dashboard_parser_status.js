const express = require('express');
const router = express.Router();
const db = require('../backend/db');

// GET /api/dashboard/parser-import-status
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
    
    
    // Get parsed data grouped by paper
    const [parsedData] = await db.query(`
      SELECT 
        ps.paper_code,
        ps.year_id,
        ps.grade_id,
        ps.subject_id,
        ps.paper_id,
        
        s.subject_name,
        s.subject_alpha_code,
        p.paper_no,
        p.paper_name,
        y.year_value,
        g.grade_number,
        COUNT(DISTINCT pr.result_id) as qp_items_parsed,
        COUNT(DISTINCT pm.memo_id) as memo_items_parsed,
        SUM(CASE WHEN pr.is_header = 1 THEN 1 ELSE 0 END) as headers_parsed
      FROM parse_sessions ps
      JOIN lookup_subjects s ON ps.subject_id = s.subject_id
      JOIN lookup_papers p ON ps.paper_id = p.paper_id
      JOIN lookup_years y ON ps.year_id = y.year_id
      JOIN lookup_grades g ON ps.grade_id = g.grade_id
      LEFT JOIN parse_results pr ON ps.session_id = pr.session_id AND pr.is_memo = 0
      LEFT JOIN parse_memos pm ON ps.session_id = pm.session_id
      WHERE 1=1 ${whereClause}
      GROUP BY ps.paper_code, ps.year_id, ps.grade_id, ps.subject_id, ps.paper_id, s.subject_name, s.subject_alpha_code, p.paper_no, p.paper_name, y.year_value, g.grade_number
      ORDER BY s.subject_name, p.paper_no, y.year_value
    `, params);
    
    // Get database data grouped by paper
    const [dbData] = await db.query(`
      SELECT 
        source_paper_code,
        COUNT(*) as qp_items_db,
        CAST(SUM(CASE WHEN memo_marks IS NOT NULL THEN 1 ELSE 0 END) AS UNSIGNED) as memo_items_db,
        CAST(SUM(CASE WHEN item_media_file IS NOT NULL THEN 1 ELSE 0 END) AS UNSIGNED) as attachments_db
      FROM item_master
      WHERE source_paper_code IS NOT NULL
      GROUP BY source_paper_code
    `);
    
    // Create a map for DB data
    const dbMap = {};
    dbData.forEach(row => {
      dbMap[row.source_paper_code] = row;
    });
    
    // Combine parsed and DB data
    const result = parsedData.map(row => {
      const dbRow = dbMap[row.paper_code] || {};
      const qpParsed = row.qp_items_parsed || 0;
      const memoParsed = row.memo_items_parsed || 0;
      const qpDb = dbRow.qp_items_db || 0;
      const memoDb = dbRow.memo_items_db || 0;
      
      let status = 'missing';
      if (qpDb >= qpParsed && memoDb >= memoParsed) {
        status = 'complete';
      } else if (qpDb > 0 || memoDb > 0) {
        status = 'partial';
      }
      
      return {
        paper_code: row.paper_code,
        subject_name: row.subject_name,
        subject_alpha_code: row.subject_alpha_code,
        paper_no: row.paper_no,
        paper_name: row.paper_name,
        year_value: row.year_value,
        grade_number: row.grade_number,
        language: 'English',
        parsed: {
          qp_items: qpParsed,
          memo_items: memoParsed,
          headers: row.headers_parsed || 0
        },
        database: {
          qp_items: qpDb,
          memo_items: memoDb,
          attachments: dbRow.attachments_db || 0
        },
        import_status: status
      };
    });
    
    // Calculate summary
    const summary = {
      total_papers: result.length,
      complete: result.filter(r => r.import_status === 'complete').length,
      partial: result.filter(r => r.import_status === 'partial').length,
      missing: result.filter(r => r.import_status === 'missing').length,
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

// GET /api/dashboard/filters
// Get available filter values
router.get('/filters', async (req, res) => {
  try {
    const [years] = await db.query('SELECT year_id, year_value FROM lookup_years ORDER BY year_value DESC');
    const [grades] = await db.query('SELECT grade_id, grade_number FROM lookup_grades ORDER BY grade_number');
    const [subjects] = await db.query('SELECT subject_id, subject_name, subject_alpha_code FROM lookup_subjects ORDER BY subject_name');
    const [papers] = await db.query('SELECT paper_id, paper_no, paper_name FROM lookup_papers ORDER BY paper_no');
    const [languages] = await db.query('SELECT language_id, language_name FROM lookup_languages ORDER BY language_name');
    
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
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;







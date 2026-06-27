// ============================================
// POST /api/v2/qp-memo-register/delete-duplicates
// ============================================
router.post('/qp-memo-register/delete-duplicates', async (req, res) => {
  try {
    const db = req.db;
    const { paper_code } = req.body;

    if (!paper_code) {
      return res.status(400).json({ success: false, message: 'paper_code is required' });
    }

    const [duplicates] = await db.query(`
      SELECT question_number, COUNT(*) as cnt, MIN(result_id) as keep_id
      FROM parse_results
      WHERE paper_code = ? AND is_memo = 0
      GROUP BY question_number
      HAVING cnt > 1
    `, [paper_code]);

    let deletedCount = 0;
    for (const dup of duplicates) {
      const [delResult] = await db.query(
        'DELETE FROM parse_results WHERE paper_code = ? AND is_memo = 0 AND question_number = ? AND result_id != ?',
        [paper_code, dup.question_number, dup.keep_id]
      );
      deletedCount += delResult.affectedRows;
    }

    const [memoDuplicates] = await db.query(`
      SELECT question_number, COUNT(*) as cnt, MIN(memo_id) as keep_id
      FROM parse_memos
      WHERE paper_code = ?
      GROUP BY question_number
      HAVING cnt > 1
    `, [paper_code]);

    let memoDeletedCount = 0;
    for (const dup of memoDuplicates) {
      const [delResult] = await db.query(
        'DELETE FROM parse_memos WHERE paper_code = ? AND question_number = ? AND memo_id != ?',
        [paper_code, dup.question_number, dup.keep_id]
      );
      memoDeletedCount += delResult.affectedRows;
    }

    res.json({
      success: true,
      message: `Deleted ${deletedCount} duplicate QP items and ${memoDeletedCount} duplicate memo items for ${paper_code}`,
      qp_deleted: deletedCount,
      memo_deleted: memoDeletedCount
    });
  } catch (error) {
    console.error('Error deleting duplicates:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// GET /api/v2/qp-memo-register/items/:paper_code (deduplicated)
// ============================================
router.get('/qp-memo-register/items/:paper_code', async (req, res) => {
  try {
    const db = req.db;
    const { paper_code } = req.params;
    const deduplicate = req.query.deduplicate === 'true';

    let qpQuery, memoQuery;

    if (deduplicate) {
      qpQuery = `
        SELECT pr.* FROM parse_results pr
        INNER JOIN (
          SELECT question_number, MIN(result_id) as min_result_id
          FROM parse_results
          WHERE paper_code = ? AND is_memo = 0
          GROUP BY question_number
        ) dup ON pr.result_id = dup.min_result_id
        WHERE pr.paper_code = ? AND pr.is_memo = 0
        ORDER BY pr.question_number
      `;
      memoQuery = `
        SELECT pm.* FROM parse_memos pm
        INNER JOIN (
          SELECT question_number, MIN(memo_id) as min_memo_id
          FROM parse_memos
          WHERE paper_code = ?
          GROUP BY question_number
        ) dup ON pm.memo_id = dup.min_memo_id
        WHERE pm.paper_code = ?
        ORDER BY pm.question_number
      `;
    } else {
      qpQuery = 'SELECT result_id, question_number, question_text, answer_text, expected_marks, auto_corrected_marks, correction_status, variance, is_red_flag, user_corrected_marks, reviewer_notes, created_at FROM parse_results WHERE paper_code = ? AND is_memo = 0 ORDER BY question_number';
      memoQuery = 'SELECT memo_id, question_number, question_text, answer_text, expected_marks, auto_corrected_marks, correction_status, variance, is_red_flag, user_corrected_marks, reviewer_notes, created_at FROM parse_memos WHERE paper_code = ? ORDER BY question_number';
    }

    const [qpItems] = await db.query(qpQuery, deduplicate ? [paper_code, paper_code] : [paper_code]);
    const [memoItems] = await db.query(memoQuery, deduplicate ? [paper_code, paper_code] : [paper_code]);

    const memoMap = new Map();
    memoItems.forEach((m) => memoMap.set(m.question_number, m));

    const items = qpItems.map((qp) => {
      const memo = memoMap.get(qp.question_number);
      const errors = [];

      if (!memo) errors.push('Missing memo');
      if (qp.expected_marks !== (memo ? memo.expected_marks : 0)) errors.push(`Marks mismatch: QP=${qp.expected_marks} vs Memo=${memo ? memo.expected_marks : 0}`);
      if (!qp.question_text || qp.question_text === '') errors.push('Empty question text');
      if (memo && (!memo.answer_text || memo.answer_text === '')) errors.push('Empty answer text');
      if (qp.is_red_flag) errors.push('QP red flag');
      if (memo && memo.is_red_flag) errors.push('Memo red flag');

      return {
        result_id: qp.result_id,
        memo_id: memo ? memo.memo_id : null,
        question_number: qp.question_number,
        question_text: qp.question_text,
        answer_text: memo ? memo.answer_text : null,
        expected_marks: qp.expected_marks,
        memo_expected_marks: memo ? memo.expected_marks : null,
        auto_corrected_marks: qp.auto_corrected_marks,
        memo_auto_corrected_marks: memo ? memo.auto_corrected_marks : null,
        correction_status: qp.correction_status,
        memo_correction_status: memo ? memo.correction_status : null,
        variance: qp.variance,
        is_red_flag: qp.is_red_flag,
        memo_is_red_flag: memo ? memo.is_red_flag : null,
        has_errors: errors.length > 0,
        error_details: errors
      };
    });

    const qpQns = new Set(qpItems.map((q) => q.question_number));
    memoItems.forEach((memo) => {
      if (!qpQns.has(memo.question_number)) {
        items.push({
          result_id: 0,
          memo_id: memo.memo_id,
          question_number: memo.question_number,
          question_text: null,
          answer_text: memo.answer_text,
          expected_marks: 0,
          memo_expected_marks: memo.expected_marks,
          auto_corrected_marks: null,
          memo_auto_corrected_marks: memo.auto_corrected_marks,
          correction_status: 'missing',
          memo_correction_status: memo.correction_status,
          variance: null,
          is_red_flag: false,
          memo_is_red_flag: memo.is_red_flag,
          has_errors: true,
          error_details: ['Orphaned memo - no matching QP']
        });
      }
    });

    items.sort((a, b) => a.question_number.localeCompare(b.question_number, undefined, { numeric: true }));

    res.json({ success: true, paper_code, items });
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

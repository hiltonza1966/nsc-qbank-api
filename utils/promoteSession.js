// ============================================================================
// QBank Promote Session to Item Master - v3 Final
// ============================================================================

const fs = require('fs');
const path = require('path');
const db = require('../backend/db');

const PARSER_OUTPUT_DIR = path.join(__dirname, '..', 'uploads', 'parser_output');
const ITEM_MEDIA_DIR = path.join(__dirname, '..', 'uploads', 'item_media');

if (!fs.existsSync(ITEM_MEDIA_DIR)) {
  fs.mkdirSync(ITEM_MEDIA_DIR, { recursive: true });
}

function collectImages(paperCode, outputDir) {
  const images = [];
  const paperDir = path.join(outputDir || PARSER_OUTPUT_DIR, paperCode);
  if (!fs.existsSync(paperDir)) return images;
  const files = fs.readdirSync(paperDir);
  for (const file of files) {
    if (/\.(png|jpg|jpeg|gif)$/i.test(file)) {
      images.push({
        filename: file,
        sourcePath: path.join(paperDir, file),
        relativePath: path.join(paperCode, file).replace(/\\/g, '/')
      });
    }
  }
  return images;
}

function copyImagesToItemMedia(paperCode, images, targetDir) {
  const targetPaperDir = path.join(targetDir || ITEM_MEDIA_DIR, paperCode);
  if (!fs.existsSync(targetPaperDir)) {
    fs.mkdirSync(targetPaperDir, { recursive: true });
  }
  const copiedImages = [];
  for (const img of images) {
    const targetPath = path.join(targetPaperDir, img.filename);
    try {
      fs.copyFileSync(img.sourcePath, targetPath);
      copiedImages.push({ ...img, targetPath: targetPath.replace(/\\/g, '/') });
    } catch (err) {
      console.error('Failed to copy image ' + img.filename + ':', err.message);
    }
  }
  return copiedImages;
}

async function promoteSessionToItemMaster(sessionId, outputDir) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [sessions] = await connection.execute(
      'SELECT * FROM parse_sessions WHERE session_id = ?',
      [sessionId]
    );
    if (sessions.length === 0) {
      throw new Error('Session ' + sessionId + ' not found');
    }
    const session = sessions[0];
    const paperCode = session.paper_code;

    const [subjectRows] = await connection.execute(
      'SELECT subject_official_code FROM lookup_subjects WHERE subject_id = ? LIMIT 1',
      [session.subject_id]
    );
    const subjectOfficialCode = subjectRows.length > 0 ? subjectRows[0].subject_official_code : '';

    const images = collectImages(paperCode, outputDir);
    const copiedImages = copyImagesToItemMedia(paperCode, images, ITEM_MEDIA_DIR);

    const [qpResults] = await connection.execute(
      'SELECT * FROM parse_results WHERE session_id = ?',
      [sessionId]
    );

    const [memoResults] = await connection.execute(
      'SELECT * FROM parse_memos WHERE session_id = ?',
      [sessionId]
    );

    const promotedItems = [];
    const promotedMemos = [];

    for (const result of qpResults) {
      const itemMediaFile = copiedImages.length > 0 ? copiedImages[0].relativePath : null;

      const marks = (result.expected_marks != null ? result.expected_marks : null) 
                 || (result.parser_extracted_marks != null ? result.parser_extracted_marks : null) 
                 || (result.auto_corrected_marks != null ? result.auto_corrected_marks : null) 
                 || 0;

      const questionText = result.question_text != null ? result.question_text : null;
      const qpMarks = result.parser_extracted_marks != null ? result.parser_extracted_marks : marks;
      const parserConfidence = result.correction_status === 'auto_corrected' ? 'green' : 'yellow';

      const safePaperId = session.paper_id != null ? session.paper_id : 1;
      const safeYearId = session.year_id != null ? session.year_id : 1;
      const safeGradeId = session.grade_id != null ? session.grade_id : 1;
      const safeSubjectId = session.subject_id != null ? session.subject_id : 1;
      const safeAssessmentTypeId = session.assessment_type_id != null ? session.assessment_type_id : 1;
      const safeAssessmentBodyId = session.assessment_body_id != null ? session.assessment_body_id : 1;
      const safeLanguageId = session.language_id != null ? session.language_id : 1;

      const qNum = (result.question_number || '').substring(0, 20);
      const safePaperCode = (paperCode || '').substring(0, 100);
      const safeSubjCode = (subjectOfficialCode || '').substring(0, 20);
      const now = new Date();

      const itemSql = `INSERT INTO item_master 
        (subject_official_code, subject_alpha_code, paper_no, year_id, grade_id, 
         subject_id, paper_id, assessment_type_id, assessment_body_id, 
         question_number, question_text, 
         source_paper_code, source_question_number, item_media_file, 
         item_type_id, cognitive_level_id, difficulty_id, language_id, 
         marks, marks_allocated, 
         caps_topic_id, caps_subtopic_id, status, review_status, 
         created_by, created_at, updated_at, qp_marks, parser_confidence) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      const itemBinds = [
        safeSubjCode,
        '',
        safePaperId,
        safeYearId,
        safeGradeId,
        safeSubjectId,
        safePaperId,
        safeAssessmentTypeId,
        safeAssessmentBodyId,
        qNum,
        questionText,
        safePaperCode,
        qNum,
        itemMediaFile,
        1,
        1,
        1,
        safeLanguageId,
        marks,
        marks,
        null,
        null,
        'draft',
        'draft',
        1,
        now,
        now,
        qpMarks,
        parserConfidence
      ];

      await connection.execute(itemSql, itemBinds);

      const [newItemRows] = await connection.execute(
        'SELECT item_id FROM item_master WHERE source_paper_code = ? AND source_question_number = ? ORDER BY created_at DESC LIMIT 1',
        [safePaperCode, qNum]
      );
      const itemId = newItemRows.length > 0 ? newItemRows[0].item_id : null;

      promotedItems.push({
        itemId: itemId,
        questionNumber: result.question_number,
        mediaFile: itemMediaFile
      });
    }

    for (const memo of memoResults) {
      const [itemRows] = await connection.execute(
        'SELECT item_id FROM item_master WHERE source_paper_code = ? AND source_question_number = ? ORDER BY created_at DESC LIMIT 1',
        [(paperCode || '').substring(0, 100), (memo.question_number || '').substring(0, 20)]
      );

      const itemId = itemRows.length > 0 ? itemRows[0].item_id : null;
      const memoMarks = (memo.expected_marks != null ? memo.expected_marks : null)
                     || (memo.parser_extracted_marks != null ? memo.parser_extracted_marks : null)
                     || (memo.auto_corrected_marks != null ? memo.auto_corrected_marks : null)
                     || 0;
      const memoAnswerText = memo.answer_text != null ? memo.answer_text : null;

      if (itemId) {
        const now = new Date();

        const memoSql = `INSERT INTO item_memos 
          (item_id, question_number, answer_text, marks, marking_guideline, is_current, created_at, updated_at) 
          VALUES (?, ?, ?, ?, ?, 1, ?, ?)`;

        const memoBinds = [
          itemId,
          (memo.question_number || '').substring(0, 20),
          memoAnswerText,
          memoMarks,
          memoAnswerText,
          now,
          now
        ];

        await connection.execute(memoSql, memoBinds);

        const [newMemoRows] = await connection.execute(
          'SELECT memo_id FROM item_memos WHERE item_id = ? AND question_number = ? ORDER BY created_at DESC LIMIT 1',
          [itemId, (memo.question_number || '').substring(0, 20)]
        );
        const memoId = newMemoRows.length > 0 ? newMemoRows[0].memo_id : null;

        promotedMemos.push({
          memoId: memoId,
          questionNumber: memo.question_number,
          itemId: itemId
        });
      }
    }

    // Insert images into item_attachments
    for (const img of copiedImages) {
      const attachmentPath = path.join('item_media', img.relativePath).replace(/\\/g, '/');
      const now = new Date();
      try {
        await connection.execute(
          `INSERT INTO item_attachments (item_id, file_name, file_path, file_size, mime_type, description, display_order, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [null, img.filename, attachmentPath, 0, 'image/png', 'Parser extracted image', 0, now]
        );
      } catch (err) {
        console.error('Failed to insert attachment for image ' + img.filename + ':', err.message);
      }
    }

    await connection.execute(
      "UPDATE parse_sessions SET status = 'imported' WHERE session_id = ?",
      [sessionId]
    );

    await connection.commit();

    return {
      success: true,
      sessionId,
      paperCode,
      itemsPromoted: promotedItems.length,
      memosPromoted: promotedMemos.length,
      imagesCopied: copiedImages.length,
      promotedItems,
      promotedMemos
    };

  } catch (err) {
    await connection.rollback();
    console.error('Promotion error:', err);
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = {
  promoteSessionToItemMaster,
  collectImages,
  copyImagesToItemMedia
};


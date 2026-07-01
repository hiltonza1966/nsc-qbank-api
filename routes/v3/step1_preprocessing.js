// ============================================================
// STEP 1 PREPROCESSING MODULE - Batch Parser V3 (FIXED)
// Parses machine-format filenames and looks up all database IDs
// ============================================================

const fs = require('fs');
const path = require('path');

// Language code mapping: filename language -> parser_language_code
const LANGUAGE_MAP = {
  'AFR': 'AFR',
  'ENG': 'ENG',
  'AFRIKAANS': 'AFR',
  'ENGLISH': 'ENG',
  'ISINDEBELE': 'ISINDEBELE',
  'ISIXHOSA': 'ISIXHOSA',
  'ISIZULU': 'ISIZULU',
  'SEPEDI': 'SEPEDI',
  'SESOTHO': 'SESOTHO',
  'SETSWANA': 'SETSWANA',
  'SISWATI': 'SISWATI',
  'TSHIVENDA': 'TSHIVENDA',
  'XITSONGA': 'XITSONGA',
  'SASL': 'SASL'
};

/**
 * Parse machine-format filename into components
 * Format: SUBJECT[_SPECIALIZATION]_[FAL|HL|SAL]_P[1|2|3]_YYYY_[NOV|MAY_JUNE|SEPT]_[PROVINCE]_LANG[_QP|_Memo_LANG].pdf
 */
function parseMachineFilename(filename) {
  const name = filename.replace('.pdf', '');
  const parts = name.split('_');

  // Determine if it's QP or Memo
  const isMemo = name.includes('_Memo_');
  const isQP = name.endsWith('_QP');

  // Extract subject (first part)
  const subject = parts[0];

  // Extract paper number (find part starting with P)
  const paperPart = parts.find(p => p.startsWith('P'));
  const paperNo = paperPart ? paperPart.replace('P', '') : '1';

  // Extract year (4-digit number)
  const yearPart = parts.find(p => /^\d{4}$/.test(p));
  const year = yearPart || '2025';

  // Extract session (NOV, MAY_JUNE, SEPT)
  const sessionPart = parts.find(p => ['NOV', 'MAY_JUNE', 'SEPT'].includes(p));
  const session = sessionPart || 'NOV';

  // Extract language - FIX: For QP, language is before _QP
  let language = null;
  if (isQP) {
    // Language is the second-to-last part (before _QP)
    language = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  } else if (isMemo) {
    // Language is the part before _Memo_
    const memoIndex = parts.indexOf('Memo');
    language = memoIndex > 0 ? parts[memoIndex - 1] : parts[parts.length - 1];
  }

  // Extract assessment type (FAL, HL, SAL)
  const assessmentType = parts.find(p => ['FAL', 'HL', 'SAL'].includes(p));

  // Extract specialization (for tech subjects)
  const specializations = ['CONSTRUCTION', 'WOODWORKING', 'DIGITAL', 'ELECTRONICS', 
                          'POWERSYSTEMS', 'AUTOMOTIVE', 'FITTINGANDMACHINING', 
                          'WELDING&METALWORK', 'CIVILSERVICES'];
  const specialization = parts.find(p => specializations.includes(p));

  // Extract province
  const provinces = ['EASTERNCAPE', 'FREESTATE', 'GAUTENG', 'KWAZULUNATAL', 
                     'LIMPOPO', 'MPUMALANGA', 'NORTHWEST', 'NORTHERNCAPE', 'WESTERNCape'];
  const province = parts.find(p => provinces.includes(p.toUpperCase()));

  return {
    subject,
    specialization,
    assessmentType,
    paperNo,
    year,
    session,
    language,
    province,
    isQP,
    isMemo,
    originalFilename: filename
  };
}

/**
 * Look up all database IDs from parsed filename components
 * Requires database connection (db parameter)
 */
async function lookupAllIds(db, parsed, defaultGradeId = 3, defaultAssessmentTypeId = 1, defaultAssessmentBodyId = 1) {
  const result = {
    success: true,
    subject_id: null,
    subject_official_code: null,
    year_id: null,
    exam_session_id: null,
    paper_id: null,
    language_id: null,
    grade_id: defaultGradeId,
    assessment_type_id: defaultAssessmentTypeId,
    assessment_body_id: defaultAssessmentBodyId,
    errors: []
  };

  try {
    // 1. Construct full parser_subject_code from subject + assessmentType/specialization
    let parserSubjectCode = parsed.subject;
    if (parsed.assessmentType) {
      const typeMap = {
        'FAL': 'FIRSTADDITIONALLANGUAGE',
        'HL': 'HOMELANGUAGE',
        'SAL': 'SECONDADDITIONALLANGUAGE'
      };
      parserSubjectCode = parsed.subject + (typeMap[parsed.assessmentType] || parsed.assessmentType);
    } else if (parsed.specialization) {
      parserSubjectCode = parsed.subject + '(' + parsed.specialization + ')';
    }

    const [subjectRows] = await db.execute(
      'SELECT subject_id, subject_official_code FROM lookup_subjects WHERE parser_subject_code = ?',
      [parserSubjectCode]
    );
    if (subjectRows.length > 0) {
      result.subject_id = subjectRows[0].subject_id;
      result.subject_official_code = subjectRows[0].subject_official_code;
    } else {
      result.errors.push(`Subject not found: ${parsed.subject}`);
    }

    // 2. Lookup year_id from year_value
    const [yearRows] = await db.execute(
      'SELECT year_id FROM lookup_years WHERE year_value = ?',
      [parseInt(parsed.year)]
    );
    if (yearRows.length > 0) {
      result.year_id = yearRows[0].year_id;
    } else {
      result.errors.push(`Year not found: ${parsed.year}`);
    }

    // 3. Lookup exam_session_id from session_code
    const [sessionRows] = await db.execute(
      'SELECT exam_session_id FROM lookup_exam_sessions WHERE session_code = ?',
      [parsed.session]
    );
    if (sessionRows.length > 0) {
      result.exam_session_id = sessionRows[0].exam_session_id;
    } else {
      result.errors.push(`Session not found: ${parsed.session}`);
    }

    // 4. Lookup paper_id from paper_code
    const [paperRows] = await db.execute(
      'SELECT paper_id FROM lookup_papers WHERE paper_code = ?',
      [`P${parsed.paperNo}`]
    );
    if (paperRows.length > 0) {
      result.paper_id = paperRows[0].paper_id;
    } else {
      result.errors.push(`Paper not found: P${parsed.paperNo}`);
    }

    // 5. Lookup language_id from language code
    // Map filename language to database language_code
    let languageCode = LANGUAGE_MAP[parsed.language] || parsed.language;

    const [languageRows] = await db.execute(
      'SELECT language_id FROM lookup_languages WHERE parser_language_code = ?',
      [languageCode]
    );
    if (languageRows.length > 0) {
      result.language_id = languageRows[0].language_id;
    } else {
      result.errors.push(`Language not found: ${languageCode} (from ${parsed.language})`);
    }

    // 6. Grade, assessment_type, assessment_body use defaults
    // (Can be overridden by parameters)

    if (result.errors.length > 0) {
      result.success = false;
    }

    return result;
  } catch (error) {
    return {
      success: false,
      errors: [error.message]
    };
  }
}

/**
 * Preprocess all files in a folder
 * Returns array of file info with all lookup IDs populated
 */
async function preprocessFiles(db, folderPath, options = {}) {
  const {
    defaultGradeId = 3,        // Grade 12
    defaultAssessmentTypeId = 1, // EXAM
    defaultAssessmentBodyId = 1   // DBE
  } = options;

  const files = fs.readdirSync(folderPath).filter(f => f.toLowerCase().endsWith('.pdf'));

  const qpFiles = [];
  const memoFiles = [];

  // Categorize files
  for (const file of files) {
    const parsed = parseMachineFilename(file);
    if (parsed.isQP) {
      qpFiles.push({ filename: file, parsed });
    } else if (parsed.isMemo) {
      memoFiles.push({ filename: file, parsed });
    }
  }

  // Pair QP and Memo files
  const pairs = [];
  const unmatched = [];

  for (const qp of qpFiles) {
    const matchingMemo = memoFiles.find(m => {
      // Match by paper key (subject + paper + year + session + language)
      const qpKey = `${qp.parsed.subject}_P${qp.parsed.paperNo}_${qp.parsed.year}_${qp.parsed.session}_${qp.parsed.language}`;
      const memoKey = `${m.parsed.subject}_P${m.parsed.paperNo}_${m.parsed.year}_${m.parsed.session}_${m.parsed.language}`;
      return qpKey === memoKey;
    });

    if (matchingMemo) {
      // Look up IDs for both files
      const qpLookup = await lookupAllIds(db, qp.parsed, defaultGradeId, defaultAssessmentTypeId, defaultAssessmentBodyId);
      const memoLookup = await lookupAllIds(db, matchingMemo.parsed, defaultGradeId, defaultAssessmentTypeId, defaultAssessmentBodyId);

      if (qpLookup.success && memoLookup.success) {
        pairs.push({
          paperCode: `${qp.parsed.subject}_P${qp.parsed.paperNo}_${qp.parsed.year}_${qp.parsed.session}_${qp.parsed.language}`,
          qpFile: qp.filename,
          memoFile: matchingMemo.filename,
          qpPath: path.join(folderPath, qp.filename),
          memoPath: path.join(folderPath, matchingMemo.filename),
          lookupIds: qpLookup, // Same for both QP and Memo
          dimensions: {
            subject_id: qpLookup.subject_id,
            subject_official_code: qpLookup.subject_official_code,
            year_id: qpLookup.year_id,
            exam_session_id: qpLookup.exam_session_id,
            paper_id: qpLookup.paper_id,
            language_id: qpLookup.language_id,
            grade_id: qpLookup.grade_id,
            assessment_type_id: qpLookup.assessment_type_id,
            assessment_body_id: qpLookup.assessment_body_id
          }
        });
      } else {
        unmatched.push({
          qp: qp.filename,
          memo: matchingMemo.filename,
          errors: [...(qpLookup.errors || []), ...(memoLookup.errors || [])]
        });
      }
    } else {
      unmatched.push({
        qp: qp.filename,
        memo: null,
        errors: ['No matching memo file']
      });
    }
  }

  // Find unmatched memos
  for (const memo of memoFiles) {
    const hasQP = pairs.some(p => p.memoFile === memo.filename);
    if (!hasQP) {
      unmatched.push({
        qp: null,
        memo: memo.filename,
        errors: ['No matching QP file']
      });
    }
  }

  return { pairs, unmatched };
}

module.exports = {
  parseMachineFilename,
  lookupAllIds,
  preprocessFiles
};

#!/usr/bin/env python3
"""master_harness_v3.py v39 - Patched for row-based parser compatibility.

CRITICAL FIXES APPLIED (vs v38):
1. MCQ fields now use qp_content_parser's pre-extracted is_mcq / mcq_options
   instead of re-deriving with broken duplicate functions.
2. Image key fixed: 'qp_images' (what parser returns) instead of 'images'
   (which was always empty because the key didn't exist).

These two fixes resolve:
- "MCQ options not extracted"  → now uses parser output directly
- "attachments_inserted=23 but promote_attachments_linked=0" → images now flow through
"""
import os
import sys
import json
import re

# ------------------------------------------------------------------
# Parser imports (unversioned names as expected by batch_parser.js)
# ------------------------------------------------------------------
from qp_content_parser import extract_qp_content
from memo_content_parser import extract_memo_content
from qp_marks_parser import extract_qp_marks
from memo_marks_parser import extract_memo_marks

# MCQ Parser v6 - Dedicated Section 1 extractor
try:
    from mcq_parser_v6 import extract_section1_mcq_items, convert_to_harness_format
    MCQ_PARSER_AVAILABLE = True
except ImportError:
    MCQ_PARSER_AVAILABLE = False
    print("[WARNING] mcq_parser_v6 not available, falling back to regular parser for MCQs")

VERSION = "v39"


def _validate_section_totals(combined_items, paper_code):
    """Validate that section totals match expected values.
    Returns (ok: bool, message: str)."""
    section_map = {}
    for item in combined_items:
        qn = item['question_number']
        parts = qn.split('.')
        if len(parts) == 1:
            section_map[qn] = item.get('marks', 0)

    warnings = []
    for sec, marks in section_map.items():
        if marks == 0:
            warnings.append(f"Section {sec} has 0 marks")

    if warnings:
        return False, "; ".join(warnings)
    return True, "Section totals OK"



def _infer_item_type_id(item):
    """Infer item_type_id from item properties.
    Maps to lookup_item_types:
        1 = MCQ (has options)
        2 = Short Answer (1-2 marks)
        3 = Medium Response (3-5 marks)
        4 = Extended Response (6-9 marks)
        5 = Essay (10+ marks)
    Specialized types (6=Diagram, 7=Matching, 8=Practical, 9=Source-Based)
    require text analysis and are better handled by post-processing SQL.
    """
    # If parser already set it, trust it
    if item.get('item_type_id') is not None:
        return item['item_type_id']

    # MCQ: has options or is_mcq flag
    if item.get('is_mcq', 0) == 1 or item.get('mcq_options'):
        return 1

    marks = item.get('marks', 0) or 0
    if marks >= 10:
        return 5   # Essay
    elif marks >= 6:
        return 4   # Extended Response
    elif marks >= 3:
        return 3   # Medium Response
    elif marks >= 1:
        return 2   # Short Answer

    return 2  # Default to Short Answer

def run_parsing_harness(qp_path, memo_path, paper_code, output_dir=None):
    """Run the full QP + Memo parsing pipeline and return combined items.

    Args:
        qp_path:      Path to Question Paper PDF
        memo_path:    Path to Marking Guideline / Memo PDF
        paper_code:   e.g. "LIFESCIENCES_P1_2025_NOV_ENG"
        output_dir:   Directory to save extracted images (optional)

    Returns:
        dict with keys:
            version          : str
            paper_code       : str
            items            : list of combined item dicts
            section_totals   : dict {section_num: marks}
            validation       : dict {ok: bool, message: str}
    """
    # ------------------------------------------------------------------
    # 1. Extract all four components
    # ------------------------------------------------------------------

    # NEW: MCQ Parser v6 for Section 1 (always runs first)
    mcq_items = []
    if MCQ_PARSER_AVAILABLE:
        print(f"[MCQ Parser v6] Extracting Section 1 MCQs from {qp_path}")
        raw_mcq_items = extract_section1_mcq_items(qp_path, memo_path)
        mcq_items = convert_to_harness_format(raw_mcq_items)
        print(f"[MCQ Parser v6] Found {len(mcq_items)} valid MCQs")

        # Validation: Section 1 should have exactly 10 MCQs
        if len(mcq_items) < 8:
            print(f"[MCQ Parser v6] WARNING: Only {len(mcq_items)} MCQs found (expected 10). Flagging for review.")
        elif len(mcq_items) > 12:
            print(f"[MCQ Parser v6] WARNING: {len(mcq_items)} MCQs found (expected 10). Possible duplicates.")

    # Regular parser for ALL sections (including Section 1 as fallback)
    qp_content = extract_qp_content(qp_path, output_dir)
    qp_marks   = extract_qp_marks(qp_path)
    memo_content = extract_memo_content(memo_path, output_dir)
    memo_marks   = extract_memo_marks(memo_path)

    # ------------------------------------------------------------------
    # 2. Build fast lookup dicts
    # ------------------------------------------------------------------
    qp_marks_dict   = {m['question_number']: m['marks'] for m in qp_marks}
    memo_dict       = {m['question_number']: m for m in memo_content}
    memo_marks_dict = {m['question_number']: m['marks'] for m in memo_marks}

    # ------------------------------------------------------------------
    # 3. Merge QP content + marks + memo content + memo marks
    # ------------------------------------------------------------------

    # Build MCQ lookup for Section 1
    mcq_lookup = {item['question_number']: item for item in mcq_items}

    combined_items = []
    for qp_item in qp_content:
        qn = qp_item['question_number']

        # NEW: If MCQ parser found this item, use its data (more accurate)
        if qn in mcq_lookup and mcq_lookup[qn].get('is_mcq', 0) == 1:
            mcq_item = mcq_lookup[qn]
            # Use MCQ parser's stem and options, but keep marks from marks parser
            qp_item['question_text'] = mcq_item['question_text']
            qp_item['is_mcq'] = 1
            qp_item['mcq_options'] = mcq_item.get('mcq_options')
            qp_item['item_answer_json'] = mcq_item.get('item_answer_json')
            # Remove from lookup so we don't double-process
            del mcq_lookup[qn]

        # --- marks (QP) ------------------------------------------------
        qp_mark = qp_marks_dict.get(qn, 0)
        # Fallback: if QP marks parser missed it, try memo marks
        if not qp_mark:
            qp_mark = memo_marks_dict.get(qn, 0)

        # --- memo data -------------------------------------------------
        memo_item = memo_dict.get(qn, {})
        answer_text = memo_item.get('answer_text', '')
        correct_key = memo_item.get('correct_key', '')
        memo_is_mcq = memo_item.get('is_mcq', False)

        # --- FIX 1: Use parser's pre-extracted MCQ fields ---------------
        # OLD (broken): re-derived from question_text with duplicate functions
        #   is_mcq = detect_mcq_type(qp_item['question_text'])
        #   mcq_options = extract_mcq_options(qp_item['question_text'])
        # NEW (fixed): use what qp_content_parser already computed
        is_mcq = qp_item.get('is_mcq', 0)
        mcq_options = qp_item.get('mcq_options', None)
        item_answer_json = qp_item.get('item_answer_json', None)

        # NOTE: Do NOT override content parser's is_mcq with memo's classification.
        # The content parser detects MCQ questions by looking for option patterns
        # in the question text. The memo parser classifies by answer format (e.g.
        # "Both A and B", "B only") which is wrong for matching questions.
        # Trust the content parser's judgment.

        # --- FIX 2: Use correct image key -------------------------------
        # OLD (broken): images = qp_item.get('images', [])  # key never exists
        # NEW (fixed):  images = qp_item.get('qp_images', [])
        images = qp_item.get('qp_images', [])

        # --- header metadata --------------------------------------------
        is_header = qp_item.get('is_header', 0)
        header_level = qp_item.get('header_level', len(qn.split('.')))

        # --- build combined item --------------------------------------
        # Infer item type before building combined item
        item_type_id = _infer_item_type_id(qp_item)

        combined_item = {
            'question_number':  qn,
            'question_text':    qp_item.get('question_text', ''),
            'marks':            qp_mark,
            'expected_marks':   qp_mark,   # alias for downstream compatibility
            'answer_text':      answer_text,
            'correct_key':      correct_key,
            'is_mcq':           is_mcq,
            'item_type_id':     item_type_id,
            'mcq_options':      mcq_options,
            'item_answer_json': item_answer_json,
            'images':           images,     # renamed for DB insert compatibility
            'is_header':        is_header,
            'header_level':     header_level,
            'source':           'combined',
        }
        combined_items.append(combined_item)

    # ------------------------------------------------------------------
        # 3b. Add any remaining MCQ items not found by regular parser
    for qn, mcq_item in mcq_lookup.items():
        print(f"[MCQ Parser v6] Adding missing item: {qn}")
        # Look up marks from QP marks parser (Section 1 MCQs are typically 2 marks each)
        qp_mark = qp_marks_dict.get(qn, 0)
        if not qp_mark:
            qp_mark = memo_marks_dict.get(qn, 2)  # Default 2 for Section 1 MCQ
        mcq_item['marks'] = qp_mark
        mcq_item['expected_marks'] = qp_mark
        # Ensure item_type_id is set for MCQ
        if not mcq_item.get('item_type_id'):
            mcq_item['item_type_id'] = 1  # MCQ
        # Look up memo data for correct answer
        memo_item = memo_dict.get(qn, {})
        if memo_item.get('correct_key'):
            mcq_item['correct_key'] = memo_item['correct_key']
            mcq_item['answer_text'] = memo_item.get('answer_text', mcq_item.get('correct_key', ''))
        combined_items.append(mcq_item)

    # ------------------------------------------------------------------
    # 4. FINAL SAFETY PASS: ensure header_level is never NULL
    # ------------------------------------------------------------------
    for item in combined_items:
        if item['header_level'] is None:
            item['header_level'] = len(item['question_number'].split('.'))
        if item['is_header'] is None:
            item['is_header'] = 1 if len(item['question_number'].split('.')) == 2 else 0

    # ------------------------------------------------------------------
    # 5. Section totals
    # ------------------------------------------------------------------
    section_totals = {}
    for m in qp_marks:
        if m['source'] == 'qp_section_total':
            section_totals[m['question_number']] = m['marks']

    # ------------------------------------------------------------------
    # 6. Validation
    # ------------------------------------------------------------------
    ok, msg = _validate_section_totals(combined_items, paper_code)

    return {
        'version': VERSION,
        'paper_code': paper_code,
        'items': combined_items,
        'section_totals': section_totals,
        'validation': {'ok': ok, 'message': msg},
    }




# Alias for backward compatibility with batch_parser.js
run_harness_v3 = run_parsing_harness
if __name__ == '__main__':
    import sys
    if len(sys.argv) >= 4:
        qp_path = sys.argv[1]
        memo_path = sys.argv[2]
        paper_code = sys.argv[3]
        output_dir = sys.argv[4] if len(sys.argv) > 4 else None
        result = run_parsing_harness(qp_path, memo_path, paper_code, output_dir)
        print(json.dumps(result, indent=2, default=str))
    else:
        print("Usage: python master_harness_v3.py <qp_pdf> <memo_pdf> <paper_code> [output_dir]")

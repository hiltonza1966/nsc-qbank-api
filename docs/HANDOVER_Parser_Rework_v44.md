# QBank Parser Rework Handover Note
# Session: 2026-07-06
# Previous Handover: v43 (Register database mode editing + Add New Item + leaf item totals)
# Next Priority: Parser v3 Rework - Hierarchy, Attachments, MCQ Detection

---

## 1. CURRENT STATE (v2 Parser)

### Parser Files (backend/parsers/)
| File | Purpose | Status |
|------|---------|--------|
| master_harness_v2.py | Main orchestrator | Working but hierarchy detection flawed |
| qp_content_parser.py | QP text extraction | Misses MCQs, tables not extracted as images |
| qp_marks_parser.py | QP marks extraction | Header/sub-header/sub-item marks not properly separated |
| memo_content_parser.py | Memo text extraction | Working |
| memo_marks_parser.py | Memo marks extraction | Working |
| parser_api_v2.py | API interface | Working |
| bilingual_cleaner.py | Language handling | Working |
| diagnostic.py | Diagnostics | Working |

### Database Schema (Key Tables)
**parse_results:**
- result_id (PK), session_id, paper_code, question_number, question_text, answer_text
- parsed_type_id, parsed_section, parser_extracted_marks, expected_marks, auto_corrected_marks
- correction_status, is_memo, is_header, parent_header_id, header_level, images (JSON)
- has_errors, variance, is_red_flag

**item_master (hierarchy fields):**
- parent_question (varchar), is_sub_part (tinyint), parent_item_id (char(36) FK)
- NO is_header field, NO header_level field

**item_attachments:**
- attachment_id, item_id (FK to item_master), stimulus_id, file_name, file_path, file_size, mime_type
- file_path pattern: item_media/{PAPER_CODE}/{qp_images|memo_images}/{filename}

### Current Issues Discovered
1. **Attachments linked to HEADERS only** (1.1, 2.1, etc.) — sub-items (1.1.6, 2.1.1) have ZERO attachments
2. **MCQs missed** — Parser fails to detect option blocks (A/B/C/D tables)
3. **Tables not extracted as images** — Blocked text, tables, diagrams in PDFs not captured
4. **Marks totals incorrect** — Header marks + sub-header marks + sub-item marks all counted in total
5. **Hierarchy detection flawed** — Headers, sub-headers, sub-items not properly distinguished
6. **Image inheritance missing** — Sub-items don't inherit images from parent headers/sub-headers

---

## 2. REQUIRED PARSER REWORK (v3)

### 2.1 Hierarchy Detection Rules

```
Header (Level 1)       -> e.g., "1.1", "2.1"
  - Introduces a section
  - Has its own total marks (sum of all children)
  - NOT counted in final item totals
  - is_header = 1, header_level = 1

Sub-Header (Level 2)   -> e.g., "1.1.1", "2.1.1"
  - Groups sub-items under a header
  - Has its own total marks (sum of its sub-items)
  - NOT counted in final item totals
  - is_header = 1, header_level = 2

Sub-Item (Level 3)     -> e.g., "1.1.5", "1.1.6", "2.1.1.1"
  - Actual questions students answer
  - Has its own individual marks
  - COUNTED in final item totals
  - is_header = 0, header_level = null
  - parent_header_id -> points to parent header
```

**Total Marks Rule:**
- Total Expected Marks = SUM of ALL sub-item marks ONLY
- Header marks = sum of all sub-headers + sub-items under it
- Sub-header marks = sum of all sub-items under it

### 2.2 Attachment Extraction Rules

**Where images appear in PDF → Which item they link to:**

| Image Location | Linked To | Example |
|---------------|-----------|---------|
| Before header text | Header item | Diagram for section 1.1 |
| Before sub-header text | Sub-header item | Table for sub-section 1.1.1 |
| Before sub-item text | Sub-item item | Diagram for question 1.1.6 |
| Between sub-items | Parent header/sub-header | Shared diagram for group |

**Attachment Inheritance:**
- Sub-items MUST inherit attachments from their parent header/sub-header
- When viewing sub-item 1.1.6, show attachments from:
  1. Sub-item 1.1.6 itself (if any)
  2. Sub-header 1.1.1 (if exists)
  3. Header 1.1 (if exists)

**Image Extraction Requirements:**
- Extract ALL images from PDF (PNG, JPG, SVG)
- Extract tables as images (render table to image)
- Extract diagrams as images
- Extract blocked text as images
- Store in: `uploads/item_media/{PAPER_CODE}/{qp_images|memo_images}/`
- Link to correct item in `item_attachments` table

### 2.3 MCQ Detection Rules

**Multiple Choice Question Types:**

| Type | Detection Pattern | Example |
|------|------------------|---------|
| Single Answer (A/B/C/D) | Option block with 4 choices | "A absence of a nucleus..." |
| Multiple Answer | "Select TWO/THREE" + option block | "Which TWO of the following..." |
| Table MCQ | Options in table format | Site of fertilisation table |
| True/False | "TRUE/FALSE" statements | "State whether each is TRUE..." |

**Parser must detect:**
- Option labels (A, B, C, D, E, F)
- Option text (what follows the label)
- Correct answer (from memo)
- Question type (single, multiple, true/false)

### 2.4 Marks Parser Rules

**For each detected item, extract:**
- Question number (e.g., 1.1.6)
- Marks allocated (from PDF text like "[2]" or "(2 marks)")
- For headers: sum of all children marks
- For sub-headers: sum of all sub-item marks
- For sub-items: individual marks

**Validation:**
- Header marks = sum(children marks) ± tolerance
- Sub-header marks = sum(sub-item marks) ± tolerance
- Total marks = sum(all sub-item marks)

---

## 3. REGISTER FIXES (Already Applied in v43)

### 3.1 Attachment Viewing (Frontend)
**File:** `frontend/src/pages/QPMemoRegister.tsx`

**Changes Made:**
1. Added QP Image Gallery inline above Question Text (200px thumbnails)
2. Replaced upload section with view-only grouped attachments (80px thumbnails)
3. Added `useEffect` to fetch attachments when `crudItem` changes
4. Modified `fetchAttachments` to accept `paperCode` and `questionNumber`
5. Added parent attachment fetch (fetches header attachments for sub-items)
6. Added backend endpoint `/api/attachments/by-question/:paper_code/:question_number`

**Backend Route Added:** `routes/attachments.js`
- `GET /api/attachments/by-question/:paper_code/:question_number`
- Finds item by source_paper_code + question_number, returns attachments

**Current Issue:** Attachments show "No attachments" because parser linked them to wrong items.
- Will be fixed when parser correctly links attachments to sub-items + inheritance

### 3.2 Build Status
- Frontend builds successfully (v43 + attachment fixes)
- Backend runs on port 4000
- Database: nsc_qbank, MySQL password: Hilton@66

---

## 4. IMPLEMENTATION PLAN

### Phase 1: Fix Attachment Linkage (Priority 1)
1. Modify `qp_content_parser.py` to track image position relative to question numbers
2. Link extracted images to the CORRECT item (sub-item, not just header)
3. Implement attachment inheritance in promotion logic
4. Test with LIFE SCIENCES P1 2025 ENG (has 524 attachments, mostly mislinked)

### Phase 2: Fix Hierarchy Detection (Priority 2)
1. Improve header/sub-header/sub-item detection in `qp_content_parser.py`
2. Set correct `is_header`, `header_level`, `parent_header_id` in parse_results
3. Ensure promotion to item_master sets correct `parent_item_id`, `is_sub_part`
4. Validate marks totals: header = sum(children), sub-header = sum(sub-items), total = sum(sub-items)

### Phase 3: MCQ Detection (Priority 3)
1. Add MCQ detection patterns to `qp_content_parser.py`
2. Detect option blocks (A/B/C/D), tables, true/false
3. Store MCQ metadata in parse_results (question_type, options, correct_answer)
4. Link MCQ options to correct sub-items

### Phase 4: Table/Image Extraction (Priority 4)
1. Extract tables as images using pdf2image or similar
2. Extract blocked text as images
3. Store all extracted media in correct folder structure
4. Link to correct items in item_attachments

---

## 5. TESTING CHECKLIST

### Attachment Tests
- [ ] Open item 1.1.6 (LIFE SCIENCES) → should show female reproductive system diagram
- [ ] Open item 1.1.8 (LIFE SCIENCES) → should show sperm diagram
- [ ] Open item 2.1.1 (LIFE SCIENCES) → should show relevant diagram
- [ ] Click image → opens full size in new tab
- [ ] All attachments grouped by QP Images / Memo Images / Other

### Hierarchy Tests
- [ ] Header 1.1 shows correct total marks (sum of 1.1.5 + 1.1.6 + 1.1.8)
- [ ] Sub-header 2.1.1 shows correct marks (sum of its sub-items)
- [ ] Sub-item 1.1.6 shows individual marks (not header total)
- [ ] Total marks = sum of ALL sub-items only

### MCQ Tests
- [ ] MCQ 1.1.5 detected with options A/B/C/D
- [ ] MCQ 1.1.6 detected with options A/B/C/D
- [ ] Table MCQ (site of fertilisation) detected correctly
- [ ] Correct answer linked from memo

---

## 6. KEY FILES TO MODIFY

| File | Changes Needed |
|------|---------------|
| backend/parsers/qp_content_parser.py | Hierarchy detection, MCQ detection, image position tracking |
| backend/parsers/master_harness_v2.py | Attachment linkage, promotion logic, marks validation |
| backend/parsers/qp_marks_parser.py | Header/sub-header/sub-item marks separation |
| backend/parsers/parser_api_v2.py | API response format for new fields |
| backend/routes/attachments.js | Already has by-question endpoint (v43) |
| frontend/src/pages/QPMemoRegister.tsx | Already has inline gallery + parent fetch (v43) |

---

## 7. ENVIRONMENT

- **Repo:** C:\dev
sc-qbank
- **Backend:** Node.js v24.14.0, Express, MySQL (nsc_qbank, password: Hilton@66)
- **Frontend:** React + Vite, TypeScript
- **Parser:** Python 3.14 (cpython-314)
- **Static files:** /uploads served via express.static
- **Attachments folder:** uploads/item_media/{PAPER_CODE}/

---

## 8. CONTACT / CONTINUITY

- Previous handover notes: docs/HANDOVER_v29.md through docs/HANDOVER_v43.md
- Git HEAD: v43 (569a402) - Register database mode editing + Add New Item + leaf item totals
- Next session should start with: Phase 1 (Fix Attachment Linkage)

---

END OF HANDOVER

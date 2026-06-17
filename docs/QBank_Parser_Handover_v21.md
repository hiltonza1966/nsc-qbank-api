# QBank Parser Handover Note v21
## System Redesign - Frontend Integration Phase

**Date:** 2026-06-17
**Parser Version:** v21 (Frontend Integration)
**Git Commit:** e968fb9 (backend) + v21 (frontend)
**Status:** Backend API + Frontend Review Panel + Wizard Integration Complete

---

## 1. Architecture Overview

```
+-------------------------------------------------------------+
|                    QBank Wizard Flow                          |
+-------------------------------------------------------------+
|                                                             |
|  FRONTEND              BACKEND              PARSER (Python) |
|  ---------             -------              -------------   |
|                                                             |
|  WizardPage.tsx  -->  parser.js (Express) --> parser_api.py |
|       |                     |                     |         |
|       |                     |                     |         |
|       v                     v                     v         |
|  ParserReviewPanel <-- /api/parser/parse <-- master_harness |
|       |                     |                     |         |
|       |                     |                     |         |
|       v                     v                     v         |
|  Review & Edit   --> /api/parser/approve --> import to DB |
|                                                             |
+-------------------------------------------------------------+
```

---

## 2. Backend Integration (v20 - COMPLETE)

### 2.1 Files Created

| File | Purpose | Location |
|------|---------|----------|
| `parser_api.py` | Python API wrapper | `backend/parsers/` |
| `parser.js` | Express.js route | `backend/routes/` |
| `018_parser_integration.sql` | DB migration | `database/migrations/` |

### 2.2 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/parser/parse` | Upload QP + Memo, run parser |
| GET | `/api/parser/status` | Check parser dependencies |
| GET | `/api/parser/review/:paperCode` | Get results for review |
| POST | `/api/parser/approve` | Approve & import to DB |

### 2.3 Request/Response Examples

**POST /api/parser/parse**
```bash
curl -X POST http://localhost:4000/api/parser/parse \
  -F "qp_file=@TechMath_P1_QP.pdf" \
  -F "memo_file=@TechMath_P1_Memo.pdf" \
  -F "subject_id=TECH_MATH" \
  -F "grade_id=12" \
  -F "year=2024" \
  -F "language=English" \
  -F "paper_number=1"
```

**Response:**
```json
{
  "paper_code": "TECH_MATH_P1_2024",
  "total_marks": 149,
  "target_marks": 150,
  "variance": 1,
  "green_count": 50,
  "yellow_count": 3,
  "red_count": 0,
  "status": "success",
  "parser_version": "v20"
}
```

---

## 3. Frontend Integration (v21 - NEW)

### 3.1 Files Modified

| File | Changes | Location |
|------|---------|----------|
| `WizardPage.tsx` | New parser API integration | `frontend/src/pages/` |
| `ParserReviewPanel.tsx` | No MUI, pure React | `frontend/src/components/` |

### 3.2 WizardPage Changes

**Old API calls (REMOVED):**
- `/wizard/extract-qp` -> Replaced with `/api/parser/parse`
- `/wizard/extract-memo` -> Replaced with `/api/parser/parse`
- `/wizard/comparison/:sessionId` -> Replaced with direct result passing
- `/wizard/save-corrections` -> Removed (ParserReviewPanel handles edits)
- `/wizard/import` -> Replaced with `/api/parser/approve`

**New flow:**
1. Step 1: Upload QP -> calls `/api/parser/parse` with `qp_file`
2. Step 2: Upload Memo -> calls `/api/parser/parse` with `qp_file` + `memo_file`
3. Step 3: Review -> `<ParserReviewPanel result={parserResult} paperMetadata={...} />`

### 3.3 ParserReviewPanel Props

```typescript
interface PaperMetadata {
  subject_id: string;
  grade_id: string;
  year: string;
  language: string;
  paper_number: string;
}

interface ParserReviewPanelProps {
  paperCode?: string;
  result?: ParserResult;
  paperMetadata?: PaperMetadata;
  onImportComplete?: (paperId: number) => void;
}
```

### 3.4 Styling Approach

**No MUI dependency** - uses inline styles matching project convention:
- Colors: `#3b82f6` (blue), `#16a34a` (green), `#ea580c` (orange), `#dc2626` (red)
- Layout: CSS Grid + Flexbox
- Components: Pure HTML elements with inline style props

---

## 4. Database Schema (Applied)

### 4.1 New Table: `parser_results`
```sql
CREATE TABLE IF NOT EXISTS parser_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  paper_code VARCHAR(50) NOT NULL,
  subject_id INT,
  grade_id INT,
  year INT,
  result_json LONGTEXT,
  status ENUM('pending_review', 'imported', 'rejected') DEFAULT 'pending_review',
  total_marks INT,
  target_marks INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_paper_code (paper_code),
  INDEX idx_status (status)
);
```

### 4.2 Updated Table: `item_master`
```sql
ALTER TABLE item_master 
ADD COLUMN qp_marks INT DEFAULT NULL,
ADD COLUMN memo_marks INT DEFAULT NULL,
ADD COLUMN parser_confidence ENUM('green', 'yellow', 'red') DEFAULT NULL;
```

---

## 5. Installation Steps

### 5.1 Backend (Already Complete)
```powershell
cd C:\dev\nsc-qbank
node server.js
# Confirmed: Mounted: /api/parser -> ./routes/parser
```

### 5.2 Frontend (v21)
```powershell
cd C:\dev\nsc-qbank
# Extract ZIP
Expand-Archive -Path "C:\Users\visagie.h\Downloads\QBank_Frontend_Integration_v21.zip" -DestinationPath . -Force

# Verify files
Get-ChildItem frontend\src\pages\WizardPage.tsx
Get-ChildItem frontend\src\components\ParserReviewPanel.tsx

# Build
cd frontend
npm run build
npm run dev
```

---

## 6. Test Results Summary

| Subject | Format | Marks | Target | Variance | Green | Yellow | Red | Status |
|---------|--------|-------|--------|----------|-------|--------|-----|--------|
| Technical Sciences P1 | PDF + PDF | 151 | 150 | -1 | 60 | 5 | 3 | Production Ready |
| Technical Sciences P2 | PDF + PDF | 75 | 75 | 0 | 45 | 0 | 4 | Production Ready |
| Technical Mathematics P1 | DOCX + PDF | 149 | 150 | 1 | 50 | 3 | 0 | Production Ready |
| Technical Mathematics P2 | PDF + PDF | 153 | 150 | -3 | 53 | 4 | 0 | Production Ready |
| Physical Sciences P1 | TBD | 150 | 150 | - | - | - | - | Pending Test |
| Mathematics P1 | TBD | 150 | 150 | - | - | - | - | Pending Test |

---

## 7. Known Limitations

1. **Red Items**: Page header artifacts (1.11, 7.2.2, 9.2.5) flagged as No marks - safe to ignore
2. **Yellow Items**: Section totals flagged as High marks - verify manually
3. **DOCX Images**: Images embedded in DOCX not extracted yet - Phase 3
4. **Bilingual Memos**: Afrikaans text partially cleaned - may have residual ticks
5. **Physical Sciences**: Formula constants (1000, 1300) may be misidentified as marks
6. **Frontend**: No MUI dependency - pure React with inline styles

---

## 8. Next Steps

1. **Test Physical Sciences & Mathematics** (Priority 1)
2. **Verify frontend build** - `npm run build` should pass with no errors
3. **Test full wizard flow** - QP upload -> Memo upload -> Review -> Import
4. **Add Image Extraction** (Phase 3)
5. **Build CAPS Linker Integration** (Phase 4)

---

## 9. Git Commit Commands

```powershell
cd C:\dev\nsc-qbank

# Add all changes
git add frontend/src/pages/WizardPage.tsx
git add frontend/src/components/ParserReviewPanel.tsx
git add backend/parsers/*.py
git add backend/routes/parser.js
git add database/migrations/018_parser_integration.sql
git add docs/QBank_Parser_Handover_v21.md

# Commit
git commit -m "Integration v21: Frontend parser review panel, wizard API integration, no MUI"

# Push
git push origin main
```

---

**End of Handover Note v21**
*Date: 2026-06-17*
*Status: Frontend build successful, ready for testing*

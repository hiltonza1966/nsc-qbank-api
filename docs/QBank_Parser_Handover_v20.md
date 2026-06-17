# QBank Parser Handover Note v20
## System Redesign - Integration Phase

**Date:** 2026-06-17
**Parser Version:** v20 (Integration)
**Git Commit:** fd0ada0 (parser v19) + integration files
**Status:** Backend API + Frontend Review Panel Ready

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              QBank Wizard Flow                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  FRONTEND                    BACKEND                    PARSER (Python)     │
│  ─────────                   ────────                   ───────────────     │
│                                                                             │
│  UploadWizard.tsx    ──▶    parser.js (Express)  ──▶   parser_api.py       │
│       │                           │                          │              │
│       │                           │                          │              │
│       ▼                           ▼                          ▼              │
│  ParserReviewPanel   ◀──    /api/parser/parse    ◀──   master_harness.py   │
│       │                           │                          │              │
│       │                           │                          │              │
│       ▼                           ▼                          ▼              │
│  Review & Edit       ──▶    /api/parser/approve  ──▶   import to DB       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Backend Integration (NEW in v20)

### 2.1 Files Created

| File | Purpose | Location |
|------|---------|----------|
| `parser_api.py` | Python API wrapper | `backend/parsers/` |
| `parser.js` | Express.js route | `backend/routes/` |
| `server_integration.txt` | Integration guide | `docs/` |

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
  -F "qp_file=@TechMath_P1_QP.docx" \
  -F "memo_file=@TechMath_P1_Memo.pdf" \
  -F "subject_id=19351084" \
  -F "grade_id=12" \
  -F "year=2024" \
  -F "language=English" \
  -F "paper_number=1"
```

**Response:**
```json
{
  "paper_code": "19351084_P1_2024",
  "total_marks": 149,
  "target_marks": 150,
  "variance": 1,
  "green_count": 50,
  "yellow_count": 3,
  "red_count": 0,
  "status": "success",
  "parser_version": "v19"
}
```

---

## 3. Frontend Review Panel (NEW in v20)

### 3.1 Component: `ParserReviewPanel.tsx`

**Features:**
- **Executive Summary Cards**: Total marks, items count, coverage %, status badges
- **Filter Tabs**: All / Green / Yellow / Red items
- **Editable Table**: Edit marks and text for Yellow/Red items
- **Import Button**: Approve all Green + fixed Yellow/Red items
- **Download JSON**: Export parser results

### 3.2 Props Interface
```typescript
interface ParserReviewPanelProps {
  paperCode?: string;           // e.g., "TECH_MATH_P1_NOV_2024"
  onImportComplete?: (paperId: number) => void;
}
```

### 3.3 Usage Example
```tsx
import { ParserReviewPanel } from './components/ParserReviewPanel';

// In Wizard page
<ParserReviewPanel 
  paperCode="TECH_MATH_P1_NOV_2024"
  onImportComplete={(paperId) => {
    console.log(`Imported paper ID: ${paperId}`);
    navigate(`/papers/${paperId}`);
  }}
/>
```

---

## 4. Database Schema (Required)

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

### 4.2 Updated Table: `question_items` (Add parser columns)
```sql
ALTER TABLE question_items ADD COLUMN IF NOT EXISTS 
  qp_marks INT DEFAULT NULL,
  memo_marks INT DEFAULT NULL,
  parser_confidence ENUM('green', 'yellow', 'red') DEFAULT NULL,
  review_status ENUM('approved', 'pending_review', 'needs_correction') DEFAULT NULL;
```

---

## 5. Installation Steps

### 5.1 Copy Files
```powershell
cd C:\dev\nsc-qbank

# 1. Create directories
New-Item -ItemType Directory -Force -Path backend\parsers
New-Item -ItemType Directory -Force -Path uploads\temp
New-Item -ItemType Directory -Force -Path uploads\parser_results

# 2. Copy parser files
Copy-Item sandbox\*.py backend\parsers\
Copy-Item backend\routes\parser.js backend\routes\ (or create new)

# 3. Copy frontend component
Copy-Item frontend\src\components\ParserReviewPanel.tsx frontend\src\components\
```

### 5.2 Update Dependencies
```bash
# Backend (Node.js)
npm install multer

# Backend (Python)
pip install PyPDF2 python-docx
```

### 5.3 Update server.js
```javascript
// Add at top with other requires
const parserRouter = require('./routes/parser');

// Add after other routes
app.use('/api/parser', parserRouter);
```

### 5.4 Apply Database Migration
```bash
mysql -u root -p nsc_qbank < database\migrations\018_add_attachments.sql
```

---

## 6. Test Results Summary

| Subject | Marks | Target | Variance | Green | Yellow | Red | Status |
|---------|-------|--------|----------|-------|--------|-----|--------|
| Technical Sciences P1 | 151 | 150 | -1 | 60 | 5 | 3 | ✅ Production Ready |
| Technical Sciences P2 | 75 | 75 | 0 | 45 | 0 | 4 | ✅ Production Ready |
| Technical Mathematics P1 | 149 | 150 | 1 | 50 | 3 | 0 | ✅ Production Ready |
| Technical Mathematics P2 | 153 | 150 | -3 | 53 | 4 | 0 | ✅ Production Ready |
| Physical Sciences P1 | TBD | 150 | - | - | - | - | 🔄 Pending Test |
| Mathematics P1 | TBD | 150 | - | - | - | - | 🔄 Pending Test |

---

## 7. Known Limitations

1. **Red Items**: Page header artifacts (1.11, 7.2.2, 9.2.5) flagged as "No marks" --- safe to ignore
2. **Yellow Items**: Section totals flagged as "High marks" --- verify manually
3. **DOCX Images**: Images embedded in DOCX not extracted yet --- Phase 3
4. **Bilingual Memos**: Afrikaans text partially cleaned --- may have residual ticks
5. **Physical Sciences**: Formula constants (1000, 1300) may be misidentified as marks

---

## 8. Next Steps

1. **Test Physical Sciences & Mathematics** (Priority 1)
2. **Integrate into Wizard Upload Flow** (Priority 2)
3. **Add Image Extraction** (Phase 3)
4. **Build CAPS Linker Integration** (Phase 4)

---

**End of Handover Note v20**

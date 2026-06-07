# NSC Item Banking System v4
## Development & Implementation Plan

**Version:** 1.0  
**Date:** 5 June 2026  
**Reference:** DBE TOR 2016, Concept Document v3 (Sept 2025), subject_structure schema

---

## EXECUTIVE SUMMARY

This plan implements the DBE Item Banking System as specified in the 2016 TOR and 2025 Concept Document, integrated with existing nsc_registration_v3 database. Development is tracked via GIT repository `nsc-qbank-v4` with phased delivery.

**Key Principle:** No assumptions — all changes based on factual schema from subject_structure table.

---

## PHASE 0: FOUNDATION (Weeks 1-2) ✅ IN PROGRESS

### Objectives
- Lock requirements from official documents
- Finalize data model using existing subject_structure
- Establish GIT workflow

### Deliverables
1. **Requirements Freeze**
   - Formative and summative item banking (TOR 3.1)
   - CAPS-aligned tagging: cognitive levels, difficulty, topic (Concept v3)
   - Generate 4 papers + marking guidelines + analysis grids
   - Psychometric analysis after field testing (200+ learners)
   - Payment audit trail and dual authorization

2. **Current Schema Analysis** (FACTUAL)
   ```sql
   -- subject_structure primary key
   PRIMARY KEY (subject_official_code, paper_no)
   
   -- Key fields confirmed
   subject_alpha_code VARCHAR(10)  -- e.g., 'AGRM', 'AGRS'
   paper_name_eng VARCHAR(50)      -- 'Paper 1', 'PAT', 'SBA'
   paper_type VARCHAR(20)          -- 'Written', 'PAT', 'SBA'
   duration DECIMAL(3,1)           -- 3.0 = 3 hours, 2.5 = 2h30
   paper_mark INT                  -- ACTUAL exam mark (200, 150, 100)
   max_mark INT                    -- Scaling mark (300)
   weighting INT                   -- Percentage (50, 25, 75)
   assessment_origin VARCHAR(20)   -- 'External' / 'Internal'
   ```

3. **GIT Structure**
   ```
   nsc-qbank-v4/
   ├── backend/
   │   ├── migrations/
   │   ├── routes/
   │   └── models/
   ├── frontend/
   │   └── src/pages/
   └── docs/
   ```

---

## PHASE 1: PAPER METADATA LAYER (Weeks 3-6)

### Objective
Replace hardcoded P1-P5 with dynamic data from subject_structure

### Task 1.1: Backend API
**Endpoint:** `GET /api/qbank/subjects-with-papers`

**SQL Query:**
```sql
SELECT 
  ss.subject_alpha_code AS code,
  ss.subject_name_eng AS name,
  ss.subject_official_code,
  ss.paper_no,
  ss.paper_name_eng,
  ss.paper_type,
  ss.duration,
  ss.paper_mark,
  ss.weighting,
  ss.assessment_origin,
  ss.grade
FROM subject_structure ss
WHERE ss.reg_type = 'FT & PT'
  AND ss.subject_alpha_code IS NOT NULL
ORDER BY ss.subject_alpha_code, ss.paper_no;
```

**Response Format:**
```json
[
  {
    "code": "AGRM",
    "name": "Agricultural Management Practices",
    "official_code": "10351024",
    "papers": [
      {
        "paper_no": 1,
        "name": "Paper 1",
        "type": "Written",
        "duration": 3.0,
        "marks": 200,
        "weighting": 50,
        "origin": "External"
      },
      {
        "paper_no": 2,
        "name": "PAT",
        "type": "PAT",
        "duration": 0,
        "marks": 100,
        "weighting": 25,
        "origin": "Internal"
      }
    ]
  }
]
```

### Task 1.2: Frontend Update
**File:** `Subjects.tsx`

**Change:** Replace hardcoded badges with dynamic rendering
```typescript
// Before: hardcoded P1-P5
// After:
{papers.map(p => (
  <Badge>
    P{p.paper_no} {p.type} • {p.marks}m • {p.duration}h • {p.weighting}%
  </Badge>
))}
```

### Task 1.3: New Table - Paper Specifications
**Purpose:** Store QPD variables separate from official DBE specs

```sql
CREATE TABLE qbank_paper_specs (
  subject_official_code VARCHAR(20) NOT NULL,
  paper_no INT NOT NULL,
  
  -- Cognitive weightings (from Concept Document)
  cognitive_weighting JSON COMMENT '{"Remember":20,"Understand":30,"Apply":30,"Analyse":10,"Evaluate":5,"Create":5}',
  
  -- Difficulty weightings
  difficulty_weighting JSON COMMENT '{"Easy":30,"Medium":50,"Hard":20}',
  
  -- CAPS topic weightings
  topic_weighting JSON,
  
  -- Rubric and marking
  rubric_template VARCHAR(50) DEFAULT 'DBE_Standard',
  marking_guideline_url VARCHAR(255),
  
  -- Paper construction rules
  num_sections TINYINT DEFAULT 2,
  compulsory_questions BOOLEAN DEFAULT TRUE,
  
  -- QA
  calculator_allowed BOOLEAN DEFAULT FALSE,
  formula_sheet BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (subject_official_code, paper_no),
  FOREIGN KEY (subject_official_code, paper_no) 
    REFERENCES subject_structure(subject_official_code, paper_no)
) ENGINE=InnoDB;
```

**GIT Commits:**
- `feat: add subjects-with-papers API`
- `feat: dynamic paper badges in Subjects.tsx`
- `migration: create qbank_paper_specs table`

---

## PHASE 2: ITEM BANKING CORE (Weeks 7-14)

### Objective
Implement item writer workflow as per Concept Document Phase 2-4

### Task 2.1: Items Table
```sql
CREATE TABLE qbank_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  
  -- Link to subject_structure
  subject_official_code VARCHAR(20) NOT NULL,
  paper_no INT NOT NULL,
  
  -- Item identification
  item_code VARCHAR(50) UNIQUE NOT NULL,
  item_number VARCHAR(20),
  
  -- Content
  question_text LONGTEXT NOT NULL,
  question_text_afr LONGTEXT,
  marks INT NOT NULL,
  estimated_time DECIMAL(4,1),
  
  -- Mandatory tagging (TOR requirement)
  cognitive_level ENUM('Remember','Understand','Apply','Analyse','Evaluate','Create') NOT NULL,
  difficulty_level ENUM('Easy','Medium','Hard') NOT NULL,
  caps_topic VARCHAR(100) NOT NULL,
  caps_subtopic VARCHAR(100),
  item_type ENUM('MCQ','Short','Medium','Extended','Source-based','Practical') NOT NULL,
  
  -- Language
  language ENUM('EN','AF','Both') DEFAULT 'EN',
  
  -- Workflow status (Concept Document)
  status ENUM('Draft','Submitted','Under_Review','Accepted','Provisionally_Accepted','Accepted_with_Corrections','Rejected') DEFAULT 'Draft',
  
  -- Audit trail
  created_by INT NOT NULL,
  reviewed_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  submitted_at TIMESTAMP NULL,
  reviewed_at TIMESTAMP NULL,
  
  -- Psychometrics (after field testing)
  p_value DECIMAL(4,3) NULL COMMENT 'Difficulty index',
  discrimination DECIMAL(4,3) NULL,
  times_used INT DEFAULT 0,
  last_used_year YEAR NULL,
  
  FOREIGN KEY (subject_official_code, paper_no) 
    REFERENCES subject_structure(subject_official_code, paper_no),
  INDEX idx_subject_paper (subject_official_code, paper_no),
  INDEX idx_status (status),
  INDEX idx_cognitive (cognitive_level)
) ENGINE=InnoDB;
```

### Task 2.2: Item Writer UI
- Create/Edit item with all mandatory tags
- Preview with marking guideline
- Submit for review

### Task 2.3: Reviewer Workflow
- Dashboard showing submitted items
- Accept/Reject with comments
- Track acceptance rates

**GIT Commits:**
- `migration: create qbank_items table`
- `feat: item writer interface`
- `feat: reviewer workflow`

---

## PHASE 3: PAPER GENERATION (Weeks 15-20)

### Objective
Generate papers aligned to specs (TOR 3.1.2)

### Task 3.1: Generation Engine
**Algorithm:**
1. Load paper specs from qbank_paper_specs
2. Query qbank_items WHERE status='Accepted' AND matches criteria
3. Select items to meet:
   - Cognitive weighting (±5% tolerance)
   - Difficulty weighting (±5% tolerance)
   - Topic weighting
   - Total marks = paper_mark from subject_structure
4. Generate 4 variants

### Task 3.2: Output Documents
- Question paper (PDF)
- Marking guideline (PDF)
- Analysis grid (Excel) — showing cognitive/difficulty distribution

### Task 3.3: Moderation
- Internal moderator review
- External moderator (Umalusi) review
- Version control

**GIT Commits:**
- `feat: paper generation engine`
- `feat: PDF export for papers`
- `feat: analysis grid generator`

---

## PHASE 4: SECURITY & PAYMENT (Weeks 21-24)

### TOR Requirements
- Dual authorization (TOR 4.2)
- Audit trail (TOR 4.5)
- Payment tracking (TOR 3.3)

### Implementation
```sql
CREATE TABLE qbank_payments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  item_id BIGINT,
  activity_type ENUM('Item_Written','Item_Reviewed','Paper_Set','Moderation'),
  amount DECIMAL(10,2),
  status ENUM('Pending','Approved','Paid'),
  approved_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES qbank_items(id)
);
```

**Security:**
- 2FA for all examiners
- Role-based access control
- All changes logged to audit table

---

## PHASE 5: TESTING & HANDOVER (Weeks 25-26)

### Testing
- Field test with 200 learners per subject (TOR requirement)
- Psychometric analysis
- Load testing for 400 concurrent examiners

### Documentation
- User manuals for each role
- Technical documentation
- Training materials

---

## IMMEDIATE NEXT STEPS

1. **Confirm Phase 1.3 table structure** — review qbank_paper_specs above
2. **Run migration** on dev database
3. **Implement API** /api/qbank/subjects-with-papers
4. **Update Subjects.tsx** to display dynamic paper data

**GIT Workflow:**
```bash
git checkout -b feature/paper-metadata
# implement changes
git add .
git commit -m "feat: add paper metadata API and UI"
git push origin feature/paper-metadata
# create PR to develop
```

---

## TRACKING

All work tracked in GIT with conventional commits:
- `feat:` new feature
- `fix:` bug fix
- `migration:` database changes
- `docs:` documentation

**Current Status:** Phase 0 complete, ready for Phase 1 implementation

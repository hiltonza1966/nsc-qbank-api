# QBank Development Plan – Corporate Edition v11
**Date:** 23 June 2026
**Status:** Phase 1-2 COMPLETE, Phase 3-6 NOT STARTED

---

## EXECUTIVE SUMMARY

| Phase | Name | Status | Completion |
|-------|------|--------|------------|
| 1 | Parser Fix + Manual Editing | ✅ COMPLETE | 2026-06-15 |
| 2 | Review & Promotion | ✅ COMPLETE | 2026-06-23 |
| 3 | Review Workflow | 🔄 NEXT | Not Started |
| 4 | Paper Builder | ❌ NOT STARTED | — |
| 5 | Quality Assurance | ❌ NOT STARTED | — |
| 6 | Deployment | ❌ NOT STARTED | — |

---

## ACHIEVEMENTS THIS SESSION (2026-06-23)

### Batch Parser v30 — FULLY OPERATIONAL
- **18 paper pairs** processed successfully
- **2,766 results** + **2,497 memos** in database
- **OCR integration** for image-based PDFs (Maths, Geography)
- **Tesseract v5.5.0** deployed and working

### Frontend Dashboards — LIVE
- **Batch Parser Dashboard** (`/batch-parser`) — Run batches, view sessions, drill-down
- **Review Board** (`/review-board`) — Promote, CRUD, paper-filtered review

### Backend APIs — OPERATIONAL
- `POST /api/v2/parser/batch` — Run batch on folder
- `POST /api/v2/parser/promote` — Promote green items to production
- `GET /api/v2/parser/review-items` — List items needing review
- `PUT /api/v2/parser/review-items/:id` — Update review item
- `DELETE /api/v2/parser/review-items/:id` — Delete review item
- `GET /api/v2/parser/promoted-items` — List promoted items

### Commits Pushed
- `3203d00` — fix(batch_parser): use categorized item arrays
- `a345a46` — feat(qp_parser): add OCR fallback
- `50a3daa` — feat(ocr): fix Windows PATH + marks parsers
- `872ac93` — feat(frontend): add Batch Parser Dashboard
- `3b073de` — feat(review-board): add Promote + CRUD

---

## PHASE 1: Parser Fix + Manual Editing — ✅ COMPLETE

### 1.1 Wizard Pipeline
- ✅ QP Upload + Extraction (76 items)
- ✅ Memo Upload + Extraction (104 items, 91 linked)
- ✅ Review Table with status badges
- ✅ Save Corrections
- ✅ Import to Database (91 items + 91 memos)

### 1.2 Batch Parser v30
- ✅ 18 paper pairs processed
- ✅ Text-based: Accounting, Life Sciences, Physical Sciences, Technical Sciences
- ✅ Image-based (OCR): Mathematics, Geography
- ✅ All items inserted into parse_results / parse_memos

---

## PHASE 2: Review & Promotion — ✅ COMPLETE

### 2.1 Batch Parser Dashboard
- ✅ Stats cards (sessions, items, marks, auto-corrected)
- ✅ Folder path input + Run button
- ✅ Batch results summary
- ✅ Parse sessions table with drill-down modal
- ✅ Session items view (question/answer/marks)

### 2.2 Review Board
- ✅ **Promote Tab** — Select sessions, bulk promote green items to item_master
- ✅ **Manual Review Tab** — Full CRUD, paper-code filtering, edit modal
- ✅ **Promoted Items Tab** — View production items with last_used_date
- ✅ Duplicate prevention (skips already promoted)

### 2.3 Backend API
- ✅ All 5 review endpoints operational
- ✅ Paper-based filtering for Subject Specialist access
- ✅ Last used date tracking for QP-imported items

---

## PHASE 3: Review Workflow — 🔄 NEXT PRIORITY

### 3.1 Three-Level Review Chain
**Status:** ❌ NOT STARTED
**Description:** Items must pass through 3 review levels before publication

| Level | Role | Action | Status Transition |
|-------|------|--------|-------------------|
| 1 | Peer Reviewer | Initial review | draft → peer_approved |
| 2 | Subject Expert | Deep review | peer_approved → expert_approved |
| 3 | Moderator | Final approval | expert_approved → moderated |

**Tasks:**
- [ ] Build review assignment system
- [ ] Create review comment threads
- [ ] Add approve/reject buttons per level
- [ ] Email notifications for reviewers
- [ ] Review deadline tracking

### 3.2 Role-Based Access Control
**Status:** ❌ NOT STARTED
**Description:** Subject Specialists see only their assigned papers

**Tasks:**
- [ ] `user_subject_assignments` table integration
- [ ] Filter Review Board by assigned subjects
- [ ] Admin panel to assign papers to reviewers
- [ ] Reviewer workload dashboard

### 3.3 Version History
**Status:** ❌ NOT STARTED
**Description:** Track all changes to items during review

**Tasks:**
- [ ] item_versions table integration
- [ ] Diff view between versions
- [ ] Rollback capability

---

## PHASE 4: Paper Builder — ❌ NOT STARTED

### 4.1 Paper Construction
**Status:** ❌ NOT STARTED**

**Tasks:**
- [ ] Select items by topic/subtopic
- [ ] Drag-and-drop paper assembly
- [ ] Section balancing (A, B, C)
- [ ] Marks distribution validation
- [ ] Time allocation calculator

### 4.2 CAPS Alignment
**Status:** ❌ NOT STARTED**

**Tasks:**
- [ ] Coverage analysis (topics covered vs required)
- [ ] Topic weighting validation
- [ ] Curriculum gap identification
- [ ] ATP/POA integration

---

## PHASE 5: Quality Assurance — ❌ NOT STARTED

### 5.1 Statistical Analysis
**Status:** ❌ NOT STARTED**

**Tasks:**
- [ ] Facility value tracking (item difficulty)
- [ ] Discrimination index calculation
- [ ] Item performance over time
- [ ] Weak item flagging

### 5.2 DLP (Data Loss Prevention)
**Status:** ❌ NOT STARTED**

**Tasks:**
- [ ] Screen capture prevention
- [ ] Print watermarking (user/device fingerprint)
- [ ] Clipboard blocking
- [ ] File download restrictions
- [ ] Session timeout enforcement
- [ ] Device binding
- [ ] Geofencing
- [ ] Real-time anomaly detection
- [ ] Immutable audit trail

---

## PHASE 6: Deployment — ❌ NOT STARTED

### 6.1 Production Setup
**Status:** ❌ NOT STARTED**

**Tasks:**
- [ ] Production environment configuration
- [ ] SSL certificates
- [ ] Database backup strategy
- [ ] Load balancing
- [ ] Monitoring/alerting

### 6.2 User Training
**Status:** ❌ NOT STARTED**

**Tasks:**
- [ ] Admin guide
- [ ] Subject Specialist guide
- [ ] Reviewer workflow guide
- [ ] Video tutorials

---

## KNOWN ISSUES & TECHNICAL DEBT

| Issue | Severity | Status | Notes |
|-------|----------|--------|-------|
| Geography marks extraction | Medium | ⚠️ Partial | OCR extracts items but marks parser finds 0-1 marks |
| Maths marks accuracy | Medium | ⚠️ Partial | OCR finds ~16/150 marks — needs better mark regex |
| Over-extraction (76 vs 40 items) | Low | ⚠️ Known | Wizard parser refinement scheduled |
| __pycache__ in git | Low | ⚠️ Known | Add to .gitignore |
| pytesseract dependency | Low | ✅ Fixed | Tesseract v5.5.0 installed |

---

## NEXT SESSION PRIORITIES (Ranked)

1. **🔥 Phase 3: Review Workflow**
   - Build three-level review chain (Peer → Expert → Moderator)
   - Role-based access for Subject Specialists

2. **🔥 Phase 3: Role-Based Access**
   - Assign papers to reviewers
   - Filter Review Board by assignment

3. **Phase 5: DLP Implementation**
   - Screen capture prevention
   - Watermarking
   - Session timeout

4. **Parser Refinement**
   - Improve Geography marks extraction
   - Better OCR mark detection for Maths

5. **Phase 4: Paper Builder**
   - Drag-and-drop paper assembly
   - CAPS coverage analysis

---

## APPENDIX: File Locations

| Component | Path |
|-----------|------|
| Batch Parser API | `routes/v2/batch_parser.js` |
| Review API | `routes/v2/parser_review.js` |
| Parser API v2 | `backend/parsers/parser_api_v2.py` |
| QP Content Parser | `backend/parsers/qp_content_parser.py` |
| QP Marks Parser | `backend/parsers/qp_marks_parser.py` |
| Memo Marks Parser | `backend/parsers/memo_marks_parser.py` |
| Batch Parser Dashboard | `frontend/src/pages/BatchParserDashboard.tsx` |
| Review Board | `frontend/src/pages/ReviewBoard.tsx` |
| App Routes | `frontend/src/App.tsx` |
| Navigation | `frontend/src/components/Layout.tsx` |

---

*End of Development Plan v11*
*Date: 2026-06-23*
*Session: Batch Parser v30 + OCR + Review Board*

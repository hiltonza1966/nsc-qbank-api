# QBank Review Workflow - AI Handover Note v34
**Date:** 23 June 2026 13:51 SAST
**System:** NSC QBank Corporate System
**Repository:** C:\dev\nsc-qbank
**Database:** nsc_qbank (MySQL, root/Hilton@66)
**Backend Port:** 4000
**Frontend Port:** 3000
**Git Branch:** main

---

## ✅ COMPLETED TODAY (2026-06-23)

| Feature | Status | Details |
|---------|--------|---------|
| **Reviewer Dashboard** | ✅ COMPLETE | Subject Filter, QP & Memo tab, Workflow History |
| **Admin Assignment Panel** | ✅ COMPLETE | Assign subjects to reviewers/experts |
| **Review Workflow API** | ✅ COMPLETE | /api/v2/review/* endpoints with correct schema |
| **Submit Review** | ✅ COMPLETE | draft → peer_approved → expert_approved → moderated |
| **Publish Action** | ✅ COMPLETE | moderated → published with audit log |
| **Moderator Dashboard** | ✅ COMPLETE | Two tabs: Expert-Approved + Ready to Publish |
| **Audit Log Fix** | ✅ COMPLETE | previous_state captured BEFORE UPDATE |
| **Layout Navbar** | ✅ COMPLETE | Item Review + Moderator links added |

---

## WORKFLOW API (v2) — CORRECTED SCHEMA

### Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v2/review/items-by-status?status=STATUS | Filter items by status |
| GET | /api/v2/review/workflow-history?item_id=ID | State transition audit log |
| POST | /api/v2/review/submit-review | Submit review + state transition |
| POST | /api/v2/review/publish-item | Publish moderated item to production |
| GET | /api/v2/review/stats | Dashboard counts by status |

### Schema Corrections (from DESCRIBE)
**item_master fields:**
- `item_id`, `question_number`, `question_text`, `status`, `difficulty`
- `grade_id` (NOT `grade`), `subject_official_code`, `subject_alpha_code`
- `published_at`, `published_by`
- **NO** `term`, `week` columns exist
- **NO** `subjects`, `topics`, `subtopics` tables — use `lookup_subjects`, `lookup_caps_topics`, `lookup_caps_subtopics`

**review_workflow fields:**
- `workflow_id` (NOT `entry_id`)
- `item_id`, `current_state`, `previous_state`
- `changed_by` (NOT `reviewer_id`), `changed_by_role`
- `subject_official_code`, `subject_alpha_code`, `paper_no`
- `transition_reason`, `created_at`

### Workflow States
```
draft → peer_approved → expert_approved → moderated → published
   ↑___________↑______________↑ (revision_required loops back)
```

---

## FILES ADDED/MODIFIED

### Frontend
```
frontend/src/pages/
  ReviewerDashboard.tsx      ← Subject Filter + QP&Memo + Workflow History
  AdminAssignmentPanel.tsx   ← Admin subject assignment panel
  ModeratorDashboard.tsx     ← Two tabs: Expert-Approved + Ready to Publish
frontend/src/components/
  Layout.tsx                 ← Added Item Review + Moderator nav links
frontend/src/App.tsx         ← Added routes for all dashboard pages
```

### Backend
```
routes/v2/
  review_workflow.js         ← Fixed: req.db pattern, correct schema, no JOINs
```

---

## TEST RESULTS

| Item | Status | Action | Result |
|------|--------|--------|--------|
| ACC 1.1 | published | Publish API | ✅ Success |
| ACC 1.1.1 | moderated | Ready to Publish tab | ✅ Shows correctly |

---

## NEXT STEPS

1. **Commit all changes to git**
2. **Test complete workflow end-to-end** with a new item
3. **Reviewer Dashboard** — verify peer_reviewer can approve draft items
4. **Subject Expert** — verify can approve peer_approved items
5. **Paper Development** — only `published` items should be selectable

---

*End of Handover Note v34*
*Date: 2026-06-23 13:51 SAST*

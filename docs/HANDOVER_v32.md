# QBank Review Workflow - AI Handover Note v32
**Date:** 23 June 2026 09:38 SAST
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
| **Reviewer Dashboard** | ✅ COMPLETE | 2766 items, Subject Filter, QP & Memo tab |
| **Admin Assignment Panel** | ✅ COMPLETE | Assign subjects to reviewers/experts |
| **Review Workflow API** | ✅ COMPLETE | /api/v2/review/* endpoints |
| **Subject Filter** | ✅ COMPLETE | Filters by subject_official_code |
| **QP & Memo Display** | ✅ COMPLETE | Side-by-side Question Paper + Memo |
| **Navigation** | ✅ COMPLETE | "Reviewer" + "Assignments" links in nav |
| **Items Import** | ✅ COMPLETE | 2766 items from parse_results → item_master |

---

## REVIEW WORKFLOW API (v2)

### Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v2/review/items-for-review | Role-based item filtering |
| POST | /api/v2/review/submit-review | Submit review + state transition |
| GET | /api/v2/review/review-threads/:itemId | Review comments by role |
| GET | /api/v2/review/workflow-history/:itemId | State transition audit log |
| GET | /api/v2/review/item-qp-memo/:itemId | QP & Memo text display |
| POST | /api/v2/review/assign-subject | Assign subject to reviewer |
| GET | /api/v2/review/assignments | List all assignments |

### Workflow States
```
draft → peer_approved → expert_approved → moderated → published
   ↑___________↑______________↑ (revision_required loops back)
```

### Audit Log Tables
- **item_reviews** — Review comments with reviewer_role, timestamp
- **review_workflow** — State transitions with previous/current state, changed_by, timestamp

---

## DATABASE STATE

### item_master (Production Items)
| subject_official_code | Count | Subject |
|-----------------------|-------|---------|
| 19351114 | 864 | Physical Sciences |
| 19351084 | 654 | (Another Science) |
| 16351054 | 546 | (Another Subject) |
| 12351024 | 371 | Accounting |
| 19331054 | 166 | (Another Subject) |
| 19351534 | 165 | (Another Subject) |
| **TOTAL** | **2766** | **6 Subjects** |

### Status Distribution
- draft: 2766 (all items start as draft)
- peer_approved: 0
- expert_approved: 0
- moderated: 0
- revision_required: 0

---

## FILES ADDED/MODIFIED

### Frontend
```
frontend/src/pages/
  ReviewerDashboard.tsx      ← NEW: Reviewer Dashboard with Subject Filter + QP&Memo
  AdminAssignmentPanel.tsx   ← NEW: Admin subject assignment panel
frontend/src/App.tsx         ← MODIFIED: Added routes + nav links
```

### Backend
```
routes/v2/
  review_workflow.js         ← NEW: Review workflow API
```

---

## DEPLOYMENT

### Restart Server
```powershell
Get-Process node | Stop-Process -Force
Start-Sleep -Seconds 2
cd C:\dev\nsc-qbank
node server.js
```

### Test Workflow
```powershell
# Get items for admin
Invoke-RestMethod -Uri "http://localhost:4000/api/v2/review/items-for-review?user_id=1&role=admin" -Method GET

# Get QP & Memo for item
Invoke-RestMethod -Uri "http://localhost:4000/api/v2/review/item-qp-memo/ITEM_ID" -Method GET

# Submit review
$body = @{
    item_id = "ITEM_ID"
    reviewer_id = "1"
    reviewer_role = "peer_reviewer"
    decision = "approve"
    comment = "Looks good"
} | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:4000/api/v2/review/submit-review" -Method POST -ContentType "application/json" -Body $body
```

---

## NEXT STEPS (Phase 3)

1. **Test Full Workflow** — Submit approval, verify status change draft → peer_approved
2. **Moderator Dashboard** — Separate view for moderators to see expert_approved items
3. **Publish/Archive Action** — After moderator approval, move to published status
4. **Audit Log Enhancement** — Ensure all approvals have exact date/time timestamps
5. **RBAC Implementation** — Role-based access control for reviewers, experts, moderators

---

*End of Handover Note v32*
*Date: 2026-06-23 09:38 SAST*
*Next Session: Test Workflow + Moderator Dashboard + Publish Action*

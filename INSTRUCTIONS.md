# QBank Review Workflow v2 — Deployment Instructions

## Files in ZIP
| File | Repo Path | Description |
|------|-----------|-------------|
| routes/v2/moderator.js | `routes/v2/moderator.js` | Backend: pending, review, publish, diagram-fix, stats, audit-log |
| frontend/src/pages/ModeratorDashboard.tsx | `frontend/src/pages/ModeratorDashboard.tsx` | Frontend: moderator dashboard UI |
| database/migrations/migration_007_review_workflow.sql | `database/migrations/migration_007_review_workflow.sql` | DB migration: review columns + audit log prep |
| SERVER_PATCH.txt | `SERVER_PATCH.txt` | Read then delete: where to add app.locals.db |
| INSTRUCTIONS.md | `INSTRUCTIONS.md` | Read then delete: this file |

## Critical Fixes in v2 (vs v1)
1. **req.db fallback**: `const db = req.db || req.app.locals.db;` — works with your middleware pattern
2. **Collation fix**: `CONVERT(... USING utf8mb4) COLLATE utf8mb4_unicode_ci` on item_attachments JOIN
3. **Audit log schema aligned**: Uses `user_id`, `old_value`, `new_value`, `reason`, `comment`, `timestamp` — matches your existing table
4. **Action ENUM aligned**: `'approve'`, `'reject'`, `'publish'`, `'state_change'` — matches your existing ENUM
5. **review_status aligned**: `'draft'`, `'approved'`, `'rejected'`, `'peer_review'` — matches your schema v6
6. **No IF NOT EXISTS**: Migration uses PREPARE/EXECUTE for MySQL compatibility
7. **marks_allocated**: Included in all INSERTs (NOT NULL per schema)
8. **item_code UNIQUE**: Generated unique codes for diagram fix items

## Step 1: Database Migration
```powershell
$mysql = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
& $mysql -u root -pHilton@66 -D nsc_qbank -e "source database/migrations/migration_007_review_workflow.sql"
```

## Step 2: Add app.locals.db to server.js
Find the line after `const dbPool = mysql.createPool({...});` and add:
```javascript
app.locals.db = dbPool;
```

## Step 3: Mount moderator.js in server.js
Add **before** existing `/api/qbank/items` routes:
```javascript
const moderatorRoutes = require('./routes/v2/moderator');
app.use('/api/qbank', moderatorRoutes);
```

## Step 4: Add Frontend Route
In `frontend/src/App.tsx`:
```tsx
import ModeratorDashboard from './pages/ModeratorDashboard';
<Route path="/moderator" element={<ModeratorDashboard />} />
```

## Step 5: Rebuild & Restart
```powershell
cd C:\dev\nsc-qbank
node -c routes/v2/moderator.js
node -c server.js

# Restart backend
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd C:\dev\nsc-qbank; node server.js" -WindowStyle Normal

# Rebuild frontend
cd frontend
npm run build
```

## API Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/qbank/items/pending` | GET | Items awaiting review |
| `/api/qbank/items/:id/review` | POST | Approve / reject / request_changes |
| `/api/qbank/items/publish` | POST | Bulk publish approved items |
| `/api/qbank/items/fix-diagram-mcqs` | POST | Fix missing diagram MCQs (1.1.x) |
| `/api/qbank/items/stats` | GET | Dashboard counts |
| `/api/qbank/audit-log` | GET | Full audit trail |

## Verified Test Results
- `/items/pending` → 200 ✓
- `/items/pending?paper_code=LIFE` → 200 ✓
- `/items/stats` → 200 ✓
- `/audit-log` → 200 ✓
- `/items/:id/review` (approve) → 200 ✓
- `/items/fix-diagram-mcqs` (dry run) → 200 ✓

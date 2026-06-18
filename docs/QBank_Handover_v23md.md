Updated AI Handover Note v23
Date: 17 June 2026 22:55 SAST
System: NSC QBank Corporate System
Repository: C:\dev\nsc-qbank
Database: nsc_qbank (MySQL, root/Hilton@66)
Backend Port: 4000
Frontend Port: 3000
Git Branch: main
Last Commit: db75e83
CURRENT STATUS
Working ✅

    Parser API: POST /api/parser/parse → 200
    WizardPage.tsx integrated with parser API
    ParserReviewPanel.tsx (no MUI)
    Loaded Dashboard v22 mounted at /api/dashboard/loaded
    CAPS Topic/Subtopic tables populated (lookup_caps_topics: 67 rows, lookup_caps_subtopics: populated)

Broken ❌

    CAPS Topic/Subtopic dropdowns in Item Create form are EMPTY
    Backend items.js accepts caps_subtopic_id but NOT caps_topic_id
    Database item_master missing caps_topic_id column
    item_caps_mapping table exists but not integrated into item create flow

CRITICAL BUG: CAPS Topic/Subtopic Dropdowns Empty
Root Cause
Table
Layer	Status	Issue
Frontend (ItemDetail.tsx)	✅ Built	Dropdowns exist, filtering logic works
Backend (items.js)	❌ Missing	Accepts caps_subtopic_id but NOT caps_topic_id
Database (item_master)	❌ Missing	No caps_topic_id column
Fix Required (3 Changes)

    Add caps_topic_id to items.js POST handler (2 lines)
    Add caps_topic_id column to item_master (1 SQL statement)
    Verify ItemDetail.tsx sends caps_topic_id in payload (should already work)

SQL Migration
sql

ALTER TABLE nsc_qbank.item_master 
ADD COLUMN caps_topic_id INT NULL AFTER difficulty_id,
ADD INDEX idx_caps_topic_id (caps_topic_id);

items.js Changes
Line ~30 (destructuring):
JavaScript

    caps_topic_id = null,  // ADD

Line ~65 (INSERT columns):
JavaScript

    caps_topic_id, caps_subtopic_id,  // ADD caps_topic_id

Line ~85 (VALUES):
JavaScript

    caps_topic_id, caps_subtopic_id,  // ADD caps_topic_id

NEXT SESSION PRIORITIES

    Fix CAPS Topic/Subtopic dropdowns (surgical fix above)
    Build CAPS Linker CRUD page for subject specialists
    Integrate item_caps_mapping into item create flow
    Test end-to-end with Life Sciences subject

FILES TO UPLOAD IN NEXT SESSION

    backend/routes/items.js (for surgical fix)
    frontend/src/pages/ItemDetail.tsx (verify payload)
    frontend/src/pages/CapsLinkerPage.tsx (new CRUD page)
    backend/routes/capsLinker.js (new backend route)

CRITICAL RULES

    Always verify schema before writing SQL
    Surgical fixes only - change only what's needed
    Test backend first - verify API with curl
    Build frontend after - only when backend works
    Commit after each fix - maintain git history

End of Handover Note v23
Date: 2026-06-17 22:55 SAST
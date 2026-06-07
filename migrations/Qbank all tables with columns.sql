USE nsc_qbank;

-- 1. All tables with columns
SELECT 
    table_name,
    column_name,
    data_type,
    column_type,
    is_nullable,
    column_default,
    extra,
    column_comment
FROM information_schema.columns
WHERE table_schema = 'nsc_qbank'
ORDER BY table_name, ordinal_position;

-- 2. All indexes and keys
SELECT 
    table_name,
    index_name,
    column_name,
    non_unique,
    index_type,
    constraint_name,
    referenced_table_name,
    referenced_column_name
FROM information_schema.statistics s
LEFT JOIN information_schema.key_column_usage k 
    ON s.table_schema = k.table_schema 
    AND s.table_name = k.table_name 
    AND s.index_name = k.constraint_name
WHERE s.table_schema = 'nsc_qbank'
ORDER BY s.table_name, s.index_name, s.seq_in_index;

-- 3. All views
SELECT 
    table_name,
    view_definition
FROM information_schema.views
WHERE table_schema = 'nsc_qbank';

-- 4. Table row counts
SELECT 
    table_name,
    table_rows
FROM information_schema.tables
WHERE table_schema = 'nsc_qbank' AND table_type = 'BASE TABLE';

-- 5. Stored procedures and functions
SELECT 
    routine_name,
    routine_type,
    definer,
    created
FROM information_schema.routines
WHERE routine_schema = 'nsc_qbank';
// test_attachment_insert_logic.js
// Simulate the exact attachment insert logic from batch_parser_v3.js

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function test() {
    // Simulate the Python parser output for one item
    const item = {
        question_number: '1.1',
        qp_images: [],
        memo_images: ['C:\\dev\\nsc-qbank\\uploads\\parser_output\\TEST_DIAGNOSTIC\\memo_images/memo_1_1_p1_img0.png'],
        image_metadata: [],
        inherited_images: undefined
    };

    // Simulate the batch_parser_v3.js logic
    const imageMetadata = item.image_metadata || [];
    const inheritedImages = item.inherited_images || [];
    const qpImages = item.qp_images || [];
    const memoImages = item.memo_images || [];
    const allImages = [];

    // From qp_images
    for (const imgPath of qpImages) {
        if (imgPath && typeof imgPath === 'string') {
            allImages.push({
                image_id: null,
                file_path: imgPath,
                file_name: path.basename(imgPath),
                page_num: 0,
                linked_question_number: item.question_number,
                is_inherited: 0
            });
        }
    }

    // From memo_images
    for (const imgPath of memoImages) {
        if (imgPath && typeof imgPath === 'string') {
            allImages.push({
                image_id: null,
                file_path: imgPath,
                file_name: path.basename(imgPath),
                page_num: 0,
                linked_question_number: item.question_number,
                is_inherited: 0
            });
        }
    }

    console.log('allImages length:', allImages.length);
    console.log('allImages:', JSON.stringify(allImages, null, 2));

    // Check if file exists
    for (const img of allImages) {
        console.log('Checking:', img.file_path);
        console.log('existsSync:', fs.existsSync(img.file_path));
        console.log('basename:', path.basename(img.file_path));
    }

    // Try the actual DB insert
    const db = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'Hilton@66',
        database: 'nsc_qbank'
    });

    const sessionId = 'TEST_SESSION_' + Date.now();
    const now = new Date();

    for (const img of allImages) {
        const fileSize = fs.existsSync(img.file_path) ? fs.statSync(img.file_path).size : 0;
        console.log('Inserting attachment:', img.file_name, 'size:', fileSize);

        try {
            await db.execute(
                `INSERT INTO item_attachments (
                    item_id, result_id, session_id, stimulus_id, file_name, file_path,
                    file_size, mime_type, attachment_type, question_number, is_extracted,
                    extracted_at, pdf_page_number, image_index, description, display_order
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    null, null, sessionId, null,
                    img.file_name, img.file_path, fileSize, 'image/png', 'image',
                    item.question_number, 1, now, 0, 0, null, 0
                ]
            );
            console.log('INSERT SUCCESS');
        } catch (err) {
            console.error('INSERT FAILED:', err.message);
        }
    }

    // Verify
    const [rows] = await db.execute(
        'SELECT COUNT(*) as count FROM item_attachments WHERE session_id = ?',
        [sessionId]
    );
    console.log('Attachments created:', rows[0].count);

    await db.end();
}

test().catch(console.error);

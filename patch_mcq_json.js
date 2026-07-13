const fs=require('fs');const f='routes/v3/batch_parser.js';let c=fs.readFileSync(f,'utf8');

// Find parse_results INSERT and add item_answer_json column
const oldParseInsert = 'images, created_at, updated_at)\n             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
const newParseInsert = 'images, item_answer_json, created_at, updated_at)\n             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

if(c.indexOf(oldParseInsert)!==-1){
  c=c.replace(oldParseInsert,newParseInsert);
  console.log('Fixed parse_results INSERT: added item_answer_json');
} else {
  console.log('parse_results INSERT pattern not found');
}

// Add item_answer_json to VALUES array (after imagesJson, before now)
const oldValues = 'imagesJson, now, now';
const newValues = 'imagesJson, item.mcq_json || null, now, now';

if(c.indexOf(oldValues)!==-1){
  c=c.replace(oldValues,newValues);
  console.log('Fixed VALUES array: added mcq_json');
} else {
  console.log('VALUES pattern not found');
}

fs.writeFileSync(f,c);
console.log('Done');

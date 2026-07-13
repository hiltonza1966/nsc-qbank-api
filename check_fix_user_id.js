const mysql=require('mysql2/promise');
(async()=>{
  const c=await mysql.createConnection({host:'localhost',user:'root',password:'Hilton@66',database:'nsc_qbank'});
  const [rows]=await c.execute("SELECT COLUMN_NAME,IS_NULLABLE,COLUMN_DEFAULT,COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='item_master' AND COLUMN_NAME='user_id'");
  console.log('Current user_id column:',JSON.stringify(rows[0]));
  if(rows.length===0){
    await c.execute("ALTER TABLE item_master ADD COLUMN user_id INT NOT NULL DEFAULT 1 AFTER created_by");
    console.log('Added user_id INT NOT NULL DEFAULT 1');
  }else if(rows[0].IS_NULLABLE==='NO' && rows[0].COLUMN_DEFAULT===null){
    await c.execute("ALTER TABLE item_master MODIFY user_id INT NOT NULL DEFAULT 1");
    console.log('Fixed user_id: INT NOT NULL DEFAULT 1');
  }else{
    console.log('user_id OK');
  }
  const [rows2]=await c.execute("SELECT COLUMN_NAME,IS_NULLABLE,COLUMN_DEFAULT,COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='item_master' AND COLUMN_NAME='user_id'");
  console.log('Updated user_id column:',JSON.stringify(rows2[0]));
  await c.end();
})();

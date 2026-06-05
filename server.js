const express=require('express'); const cors=require('cors'); const mysql=require('mysql2/promise'); require('dotenv').config();
const app=express(); app.use(cors()); app.use(express.json());
const pool=mysql.createPool({host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME});
app.use((req,res,next)=>{req.db=pool;next();});
app.use('/api/qbank/items',require('./routes/items'));
app.use('/api/qbank/papers',require('./routes/papers'));
app.use('/api/qbank/specs',require('./routes/specs'));
app.get('/health',(req,res)=>res.json({status:'ok'}));
app.listen(4000,()=>console.log('QBank API running on port 4000'));
import pkg from "pg";
//cant directly import Pool from pg since pg is a common js module, doesnt allow direct
//import
import dotenv from "dotenv";
dotenv.config();


const { Pool } = pkg;
//pool of connections which will be used each time to connect to the database.
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

pool.on("connect", ()=> {
    console.log("connection pool has been established with database :D");
});

export default pool;
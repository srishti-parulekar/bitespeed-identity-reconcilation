import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool from "./config/db.js";
dotenv.config();

const app = express();
const port = process.env.PORT || 3001

//middlewares
app.use(express.json());
app.use(cors());

//need to add routes here

//error handling middleware

//testing postgres connection 
app.get("/", async(req,res) =>{
    const result = await pool.query("SELECT current_database()");
    res.send(`The database name is: ${result.rows[0].current_database}`)
});

//server running 
app.listen(port, () => {
    console.log(`Server is running on http:localhost:${port}`)
})
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool from "./config/db.js";
import contactRoutes from "./routes/contactRoutes.js";
import { errorHandler } from "./middlewares/errorHandler.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

//middlewares
app.use(express.json());
app.use(cors());

//routes
app.use("/api", contactRoutes);

//testing postgres connection
app.get("/", async(req,res) => {
    try {
        const result = await pool.query("SELECT current_database()");
        res.send(`The database name is: ${result.rows[0].current_database}`);
    } catch (error) {
        res.status(500).json({ error: 'Database connection failed' });
    }
});

// Health check endpoint
app.get("/health", async (req, res) => {
    try {
        await pool.query("SELECT 1");
        res.status(200).json({ 
            status: "healthy", 
            database: "connected",
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(503).json({ 
            status: "unhealthy", 
            database: "disconnected",
            error: error.message
        });
    }
});

//error handling middleware
app.use(errorHandler);


//server running
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
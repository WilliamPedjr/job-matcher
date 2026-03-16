const dotenv = require("dotenv");
const mysql = require("mysql2/promise");
const path = require("path");
const fs = require("fs");
const { initDb } = require("./db/initDb");

dotenv.config();

const readJobsSeed = () => {
  const jobsSeedPath = path.join(__dirname, "jobs.json");
  try {
    const raw = fs.readFileSync(jobsSeedPath, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Read jobs seed error:", error);
    return [];
  }
};

const createDatabaseIfMissing = async () => {
  const host = process.env.DB_HOST || "localhost";
  const port = Number(process.env.DB_PORT || 3306);
  const user = process.env.DB_USER || "root";
  const password = process.env.DB_PASSWORD || "";
  const database = process.env.DB_NAME || "capstone_db";

  const adminConn = await mysql.createConnection({ host, port, user, password });
  await adminConn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
  await adminConn.end();

  const pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 5
  });

  await initDb(pool, readJobsSeed());
  await pool.end();

  console.log(`Database ready: ${database}`);
};

createDatabaseIfMissing().catch((error) => {
  console.error("Setup DB failed:", error);
  process.exit(1);
});

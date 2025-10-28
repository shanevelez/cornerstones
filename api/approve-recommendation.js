// /api/approve-recommendation.js
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { id, action } = req.body;

    if (!id || !["approved", "rejected"].includes(action)) {
      return res.status(400).json({ error: "Invalid payload." });
    }

    const query = `
      UPDATE recommendations
      SET status = $1
      WHERE id = $2
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [action, id]);
    if (rows.length === 0) return res.status(404).json({ error: "Not found." });

    return res.status(200).json({ success: true, recommendation: rows[0] });
  } catch (err) {
    console.error("Approve recommendation error:", err);
    return res.status(500).json({ error: "Server error updating recommendation." });
  }
}

// /api/update-recommendation.js
import { Pool } from "pg";
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  if (req.method !== "PATCH") {
    res.setHeader("Allow", ["PATCH"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { id, fields } = req.body;
    if (!id || typeof fields !== "object")
      return res.status(400).json({ error: "Invalid payload." });

    const columns = Object.keys(fields);
    const values = Object.values(fields);
    const setClause = columns.map((c, i) => `${c} = $${i + 2}`).join(", ");

    const query = `UPDATE recommendations SET ${setClause} WHERE id = $1 RETURNING *;`;
    const { rows } = await pool.query(query, [id, ...values]);
    if (!rows.length) return res.status(404).json({ error: "Not found." });

    return res.status(200).json({ success: true, recommendation: rows[0] });
  } catch (err) {
    console.error("Update recommendation error:", err);
    res.status(500).json({ error: "Failed to update recommendation." });
  }
}

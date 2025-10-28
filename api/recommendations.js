import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  if (req.method === "POST") {
    try {
      const { name, address, description, category, tags, photos } = req.body;

      if (!name || !description || !category) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const query = `
        INSERT INTO recommendations (name, address, description, category, tags, photos, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'pending')
        RETURNING *;
      `;
      const values = [
        name,
        address || null,
        description,
        category, // plain string
        tags || [],
        photos || [],
      ];

      const { rows } = await pool.query(query, values);
      res.status(200).json({ success: true, recommendation: rows[0] });
    } catch (error) {
      console.error("Insert error:", error);
      res.status(500).json({ error: "Failed to save recommendation" });
    }
  } else if (req.method === "GET") {
    try {
      const { rows } = await pool.query(
        "SELECT * FROM recommendations WHERE status = 'approved' ORDER BY created_at DESC;"
      );
      res.status(200).json(rows);
    } catch (error) {
      console.error("Fetch error:", error);
      res.status(500).json({ error: "Failed to load recommendations" });
    }
  } else {
    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

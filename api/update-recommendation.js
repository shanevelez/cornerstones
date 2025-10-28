// /api/update-recommendation.js
import { IncomingForm } from "formidable";
import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";

export const config = { api: { bodyParser: false } };

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  if (req.method === "POST") {
    const form = new IncomingForm({ multiples: true, keepExtensions: true });

    form.parse(req, async (err, fields) => {
      if (err) {
        console.error("Form parse error:", err);
        return res.status(500).json({ error: "Failed to parse form data" });
      }

      try {
        const normalize = (v) => (Array.isArray(v) ? v[0] : v ?? null);

        const id = normalize(fields.id);
        if (!id) return res.status(400).json({ error: "Missing recommendation ID" });

        const name = normalize(fields.name);
        const address = normalize(fields.address);
        const description = normalize(fields.description);
        const category = normalize(fields.category);
        const submitted_by = normalize(fields.submitted_by);
        const tags = fields.tags ? JSON.parse(normalize(fields.tags)) : [];
        const photos = fields.photos ? JSON.parse(normalize(fields.photos)) : [];

        const query = `
          UPDATE recommendations
          SET
            name = $2,
            address = $3,
            description = $4,
            category = $5,
            tags = $6,
            photos = $7,
            submitted_by = $8
          WHERE id = $1
          RETURNING *;
        `;

        const values = [
          id,
          name,
          address,
          description,
          category,
          tags,
          photos,
          submitted_by,
        ];

        const { rows } = await pool.query(query, values);
        if (!rows.length)
          return res.status(404).json({ error: "Recommendation not found" });

        return res.status(200).json({ success: true, recommendation: rows[0] });
      } catch (e) {
        console.error("Update error:", e);
        return res.status(500).json({ error: e.message });
      }
    });
  } else {
    res.setHeader("Allow", ["POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

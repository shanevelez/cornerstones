import { IncomingForm } from "formidable";
import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";
import fs from "fs";

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

    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error("Form parse error:", err);
        return res.status(500).json({ error: "Failed to parse form data" });
      }

      try {
        // Flatten single-value fields
        const normalize = (v) =>
          Array.isArray(v) ? v[0] : v ?? null;

        const name = normalize(fields.name);
        const address = normalize(fields.address);
        const description = normalize(fields.description);
        const category = normalize(fields.category);
        const submitted_by = normalize(fields.submitted_by); // 👈 NEW
        const tags = fields.tags ? JSON.parse(normalize(fields.tags)) : [];
        const uploadedUrls = [];

        // Handle uploads
        const fileList = Array.isArray(files.photos)
          ? files.photos
          : files.photos
          ? [files.photos]
          : [];

        for (const file of fileList) {
          const fileBuffer = fs.readFileSync(file.filepath);
          const filePath = `uploads/${Date.now()}-${file.originalFilename}`;

          const { error: uploadError } = await supabase.storage
            .from("recommendations")
            .upload(filePath, fileBuffer, { contentType: file.mimetype });

          if (uploadError) throw uploadError;

          const { data: publicUrlData } = supabase.storage
            .from("recommendations")
            .getPublicUrl(filePath);

          uploadedUrls.push(publicUrlData.publicUrl);
        }

        // Insert into DB
        const query = `
          INSERT INTO recommendations 
          (name, address, description, category, tags, photos, submitted_by, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
          RETURNING *;
        `;

        const values = [
          name,
          address,
          description,
          category,
          tags,
          uploadedUrls,
          submitted_by,
        ];

        const { rows } = await pool.query(query, values);
        return res.status(200).json({ success: true, recommendation: rows[0] });
      } catch (e) {
        console.error("Insert error:", e);
        res.status(500).json({ error: e.message });
      }
    });
  } else if (req.method === "GET") {
    try {
      const { rows } = await pool.query(
        "SELECT * FROM recommendations WHERE status = 'approved' ORDER BY created_at DESC;"
      );
      res.status(200).json(rows);
    } catch (e) {
      res.status(500).json({ error: "Failed to load recommendations" });
    }
  } else {
    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

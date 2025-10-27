import { Pool } from "pg";
import { createClient } from "@supabase/supabase-js";
import imageCompression from "browser-image-compression"; // keep for backend compress if needed
import formidable from "formidable";
import fs from "fs";

export const config = {
  api: {
    bodyParser: false, // important for file uploads
  },
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method === "POST") {
    try {
      // parse multipart form data (files + text fields)
      const form = formidable({ multiples: true });
      const [fields, files] = await new Promise((resolve, reject) => {
        form.parse(req, (err, fields, files) => {
          if (err) reject(err);
          else resolve([fields, files]);
        });
      });

      const { name, address, description, category, tags } = fields;
      if (!name || !description || !category) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const uploadedUrls = [];

      // upload each image through service key
      if (files.photos) {
        const photoArray = Array.isArray(files.photos)
          ? files.photos
          : [files.photos];

        for (const file of photoArray) {
          const data = fs.readFileSync(file.filepath);
          const filePath = `uploads/${Date.now()}-${file.originalFilename}`;
          const { error: uploadError } = await supabase.storage
            .from("recommendations")
            .upload(filePath, data, {
              contentType: file.mimetype,
            });
          if (uploadError) throw uploadError;

          const { data: publicUrlData } = supabase.storage
            .from("recommendations")
            .getPublicUrl(filePath);
          uploadedUrls.push(publicUrlData.publicUrl);
        }
      }

      const query = `
        INSERT INTO recommendations (name, address, description, category, tags, photos, status)
        VALUES ($1,$2,$3,$4,$5,$6,'pending')
        RETURNING *;
      `;
      const values = [
        name,
        address || null,
        description,
        category,
        tags ? JSON.parse(tags) : [],
        uploadedUrls,
      ];

      const { rows } = await pool.query(query, values);
      return res.status(200).json({ success: true, recommendation: rows[0] });
    } catch (error) {
      console.error("Insert error:", error);
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === "GET") {
    try {
      const { rows } = await pool.query(
        "SELECT * FROM recommendations WHERE status = 'approved' ORDER BY created_at DESC"
      );
      return res.status(200).json(rows);
    } catch (error) {
      console.error("Fetch error:", error);
      return res.status(500).json({ error: "Failed to load recommendations" });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}

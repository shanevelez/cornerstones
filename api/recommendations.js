import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export const config = {
  api: { bodyParser: false }, // allow FormData streams
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST", "GET"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    // parse multipart FormData manually
    const buffers = [];
    for await (const chunk of req) buffers.push(chunk);
    const body = Buffer.concat(buffers);

    // use a tiny boundary parser
    const boundary = req.headers["content-type"].split("boundary=")[1];
    const parts = body.toString().split(`--${boundary}`);

    // collect text fields + files
    const fields = {};
    const uploadedUrls = [];
    for (const part of parts) {
      if (part.includes("Content-Disposition: form-data;")) {
        const nameMatch = part.match(/name="([^"]+)"/);
        if (!nameMatch) continue;
        const name = nameMatch[1];

        const filenameMatch = part.match(/filename="([^"]+)"/);
        if (filenameMatch) {
          // file content
          const fileContent = part.split("\r\n\r\n")[1]?.split("\r\n")[0];
          const buffer = Buffer.from(fileContent || "", "binary");
          const filePath = `uploads/${Date.now()}-${filenameMatch[1]}`;
          const { error: uploadError } = await supabase.storage
            .from("recommendations")
            .upload(filePath, buffer, { contentType: "image/jpeg" });
          if (uploadError) throw uploadError;

          const { data: publicUrlData } = supabase.storage
            .from("recommendations")
            .getPublicUrl(filePath);
          uploadedUrls.push(publicUrlData.publicUrl);
        } else {
          const value = part.split("\r\n\r\n")[1]?.split("\r\n")[0];
          fields[name] = value;
        }
      }
    }

    const { name, address, description, category } = fields;
    const tags = fields.tags ? JSON.parse(fields.tags) : [];

    if (!name || !description || !category)
      return res.status(400).json({ error: "Missing required fields" });

    const query = `
      INSERT INTO recommendations (name, address, description, category, tags, photos, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'pending')
      RETURNING *;
    `;
    const values = [
      name,
      address || null,
      description,
      category,
      tags,
      uploadedUrls,
    ];
    const { rows } = await pool.query(query, values);
    return res.status(200).json({ success: true, recommendation: rows[0] });
  } catch (err) {
    console.error("Insert error:", err);
    return res.status(500).json({ error: err.message });
  }
}

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { name, category, submitted_by } = req.body;

    // 1️⃣ Fetch all admin users
    const { data: admins, error } = await supabase
      .from("users")
      .select("email")
      .eq("role", "Admin");

    if (error) throw error;
    if (!admins || admins.length === 0) {
      return res.status(200).json({ message: "No admin users found" });
    }

    // 2️⃣ Build the email content
    const subject = `New Local Recommendation: ${name}`;
    const html = `
      <div style="font-family: sans-serif; line-height: 1.6;">
        <h2>New Recommendation Submitted</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Category:</strong> ${category}</p>
        <p><strong>Submitted by:</strong> ${submitted_by}</p>
        <p>Please log in to the Admin Dashboard to review and approve this recommendation.</p>
        <br />
        <a href="${process.env.NEXT_PUBLIC_SITE_URL}/admin"
           style="background-color:#f4b400;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">
           View Dashboard
        </a>
      </div>
    `;

    // 3️⃣ Send emails to all admins (individually)
    const sendPromises = admins.map((admin) =>
      resend.emails.send({
        from: "Cornerstones <booking@cornerstonescrantock.com>",
        to: admin.email,
        subject,
        html,
      })
    );

    await Promise.all(sendPromises);

    res.status(200).json({ message: "Admin notifications sent successfully" });
  } catch (err) {
    console.error("Error notifying admins:", err);
    res.status(500).json({ error: err.message });
  }
}

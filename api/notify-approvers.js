import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);


export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { bookingId, guest_name, check_in, check_out } = req.body;

    // 1️⃣ get all Admin + Approver users
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('email, role')
      .in('role', ['Admin', 'Approver']);

    if (userError) throw userError;

    const recipientEmails = users.map((u) => u.email);

    // 2️⃣ construct links
    const bookingLink = `https://cornerstonesbooking.vercel.app/admin?booking=${bookingId}`;
    const dashboardLink = `https://cornerstonesbooking.vercel.app/admin`;

    // 3️⃣ send email
    await resend.emails.send({
      from: 'Cornerstones Booking <onboarding@resend.dev>',
      to: recipientEmails,
      subject: `New Booking Pending Approval – ${guest_name}`,
      html: `
  <div style="font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f9f9f9;padding:32px;">
    <table style="max-width:580px;margin:auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #eee;">
      <tr>
        <td style="background:#e7b333;color:#0f2b4c;padding:20px 24px;font-size:20px;font-weight:bold;">
          Cornerstones Booking – New Request
        </td>
      </tr>
      <tr>
        <td style="padding:24px;color:#333;">
          <p style="font-size:16px;margin:0 0 12px 0;"><strong>Guest:</strong> ${guest_name}</p>
          <p style="font-size:16px;margin:0 0 12px 0;">
            <strong>Check-in:</strong> ${new Date(check_in).toLocaleDateString()}<br>
            <strong>Check-out:</strong> ${new Date(check_out).toLocaleDateString()}
          </p>
          <p style="font-size:15px;margin-top:24px;color:#444;">
            Please review and approve this booking below.
          </p>
          <p style="margin:30px 0;">
            <a href="https://www.cornerstonescrantock.com/admin?booking=${bookingId}"
              style="background:#e7b333;color:#0f2b4c;padding:12px 28px;border-radius:6px;
                     text-decoration:none;font-weight:600;font-size:15px;display:inline-block;">
              View this Booking
            </a>
          </p>
          <hr style="border:none;border-top:1px solid #ddd;margin:30px 0;">
          <p style="font-size:14px;color:#555;">
            Or view all pending bookings at
            <a href="https://www.cornerstonescrantock.com/admin"
               style="color:#0f2b4c;font-weight:600;text-decoration:none;">
               www.cornerstonescrantock.com/admin
            </a>
          </p>
        </td>
      </tr>
      <tr>
        <td style="background:#f2deac;padding:16px 24px;color:#0f2b4c;font-size:13px;text-align:center;">
          © ${new Date().getFullYear()} Cornerstones Crantock · Automated Notification
        </td>
      </tr>
    </table>
  </div>
`
,
    });

    return res.status(200).json({ success: true, sentTo: recipientEmails });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to send notifications', details: err.message });
  }
}

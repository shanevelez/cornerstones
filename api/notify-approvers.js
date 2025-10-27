import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // use a service key for secure role lookup
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
      from: 'Cornerstones Booking <no-reply@cornerstonescrantock.com>',
      to: recipientEmails,
      subject: `New Booking Pending Approval – ${guest_name}`,
      html: `
        <div style="font-family:sans-serif; color:#333">
          <h2>New Booking Request</h2>
          <p><strong>Guest:</strong> ${guest_name}</p>
          <p><strong>Check-in:</strong> ${new Date(check_in).toLocaleDateString()}</p>
          <p><strong>Check-out:</strong> ${new Date(check_out).toLocaleDateString()}</p>
          <p style="margin-top:20px;">
            <a href="${bookingLink}" style="background:#f4b400;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">View this Booking</a>
          </p>
          <p style="margin-top:10px;">
            Or view all pending bookings at 
            <a href="${dashboardLink}">${dashboardLink}</a>.
          </p>
        </div>
      `,
    });

    return res.status(200).json({ success: true, sentTo: recipientEmails });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to send notifications', details: err.message });
  }
}

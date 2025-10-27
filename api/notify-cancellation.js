import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { bookingId, reason } = req.body;
    if (!bookingId) return res.status(400).json({ error: 'Missing bookingId' });

    // ---- 1️⃣ fetch booking details ----
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // ---- 2️⃣ get cancellation reason (from table if needed) ----
    let cancellationReason = reason;
    if (!reason) {
      const { data: cancellation, error: cancelErr } = await supabase
        .from('cancellations')
        .select('reason')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (!cancelErr && cancellation) cancellationReason = cancellation.reason;
    }

    // ---- 3️⃣ get admin & approver emails ----
    const { data: approvers, error: roleError } = await supabase
      .from('users')
      .select('email, role')
      .in('role', ['Admin', 'Approver']);

    if (roleError || !approvers?.length) {
      console.error('No approvers found:', roleError);
    }

    const recipients = approvers?.map((u) => u.email) || [];

    // ---- 4️⃣ format data ----
    const checkIn = new Date(booking.check_in).toLocaleDateString('en-GB');
    const checkOut = new Date(booking.check_out).toLocaleDateString('en-GB');
    const year = new Date(booking.check_in).getFullYear();
    const bookingNumber = `${year}${String(booking.id).padStart(2, '0')}`;

    // ---- 5️⃣ build HTML for admin notification ----
    const adminHtml = `
      <div style="font-family:Arial, sans-serif; max-width:600px; margin:auto; border:1px solid #ddd; border-radius:8px; overflow:hidden">
        <div style="background-color:#0f2b4c; color:white; padding:16px 24px;">
          <h2 style="margin:0;">Cornerstones Booking Cancelled</h2>
        </div>
        <div style="padding:24px; background:#fff;">
          <p style="font-size:15px; color:#333;">
            A booking has been <strong>cancelled</strong> by the guest.
          </p>

          <table style="width:100%; border-collapse:collapse; margin-top:12px; font-size:14px;">
            <tr><td style="padding:6px 0;"><strong>Booking #:</strong></td><td>${bookingNumber}</td></tr>
            <tr><td style="padding:6px 0;"><strong>Guest Name:</strong></td><td>${booking.guest_name}</td></tr>
            <tr><td style="padding:6px 0;"><strong>Email:</strong></td><td>${booking.guest_email}</td></tr>
            <tr><td style="padding:6px 0;"><strong>Check-in:</strong></td><td>${checkIn}</td></tr>
            <tr><td style="padding:6px 0;"><strong>Check-out:</strong></td><td>${checkOut}</td></tr>
            <tr><td style="padding:6px 0;"><strong>Adults:</strong></td><td>${booking.adults}</td></tr>
            <tr><td style="padding:6px 0;"><strong>Grandchildren over 21:</strong></td><td>${booking.grandchildren_over21}</td></tr>
            <tr><td style="padding:6px 0;"><strong>Children 16+:</strong></td><td>${booking.children_16plus}</td></tr>
            <tr><td style="padding:6px 0;"><strong>Students:</strong></td><td>${booking.students}</td></tr>
            <tr><td style="padding:6px 0;"><strong>Family Member:</strong></td><td>${booking.family_member ? 'Yes' : 'No'}</td></tr>
          </table>

          <div style="margin-top:24px; border-top:1px solid #ddd; padding-top:16px;">
            <p style="margin:0 0 6px;"><strong>Cancellation Reason:</strong></p>
            <p style="background:#f8f8f8; padding:12px; border-radius:4px;">${cancellationReason}</p>
          </div>

          <div style="margin-top:24px; text-align:center;">
            <a href="https://www.cornerstonescrantock.com/admin"
               style="background:#e7b333; color:#0f2b4c; padding:10px 20px; text-decoration:none; border-radius:4px; font-weight:bold;">
              View Dashboard
            </a>
          </div>
        </div>
        <div style="background:#f4f4f4; text-align:center; padding:10px; font-size:12px; color:#666;">
          © ${year} Cornerstones, Crantock
        </div>
      </div>
    `;

    // ---- 6️⃣ build guest confirmation HTML ----
    const guestHtml = `
      <div style="font-family:Arial, sans-serif; max-width:600px; margin:auto; border:1px solid #ddd; border-radius:8px; overflow:hidden">
        <div style="background-color:#0f2b4c; color:white; padding:16px 24px;">
          <h2 style="margin:0;">Your Booking Has Been Cancelled</h2>
        </div>
        <div style="padding:24px; background:#fff;">
          <p style="font-size:15px; color:#333;">
            Hi ${booking.guest_name}, your booking at <strong>Cornerstones Crantock</strong> has been successfully cancelled.
          </p>
          <p>Your booking details were:</p>
          <ul style="font-size:14px; color:#333; line-height:1.5;">
            <li><strong>Booking #:</strong> ${bookingNumber}</li>
            <li><strong>Check-in:</strong> ${checkIn}</li>
            <li><strong>Check-out:</strong> ${checkOut}</li>
          </ul>
          <p style="margin-top:16px; font-size:14px; color:#333;">
            <strong>Your reason for cancellation:</strong><br/>
            <em>${cancellationReason}</em>
          </p>
          <p style="margin-top:24px;">We’re sorry to miss you, but hope to welcome you another time.</p>
          <div style="margin-top:24px; text-align:center;">
            <a href="https://www.cornerstonescrantock.com"
               style="background:#e7b333; color:#0f2b4c; padding:10px 20px; text-decoration:none; border-radius:4px; font-weight:bold;">
              Visit Website
            </a>
          </div>
        </div>
        <div style="background:#f4f4f4; text-align:center; padding:10px; font-size:12px; color:#666;">
          © ${year} Cornerstones, Crantock
        </div>
      </div>
    `;

    // ---- 7️⃣ send admin/approver notification ----
    if (recipients.length > 0) {
      await resend.emails.send({
        from: 'Cornerstones <bookings@cornerstonescrantock.com>',
        to: recipients,
        subject: `Booking Cancelled – ${booking.guest_name} (${bookingNumber})`,
        html: adminHtml,
      });
    }

    // ---- 8️⃣ send guest confirmation ----
    await resend.emails.send({
      from: 'Cornerstones <bookings@cornerstonescrantock.com>',
      to: booking.guest_email,
      subject: `Your Booking at Cornerstones Crantock Has Been Cancelled`,
      html: guestHtml,
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Notify cancellation error:', err);
    return res.status(500).json({ error: err.message });
  }
}

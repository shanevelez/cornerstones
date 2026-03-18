import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  // A simple password so nobody else can trigger your emails
  if (req.query.secret !== 'crantock2026') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 1️⃣ Get all approved bookings for this year
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('status', 'approved')
      .gte('check_in', '2026-01-01');

    if (error || !bookings) throw new Error('Could not get bookings');

    let sentCount = 0;

    // 2️⃣ Go through each booking and send the test email to you
    for (const booking of bookings) {
      const { guest_name, check_in, check_out } = booking;

      const adults = booking.adults || 0;
      const grandchildren = booking.grandchildren_over21 || 0;
      const youngPersons = (booking.children_16plus || 0) + (booking.students || 0);

      const arrive = new Date(check_in).toLocaleDateString('en-GB');
      const depart = new Date(check_out).toLocaleDateString('en-GB');

      // 3️⃣ Build the guest rows conditionally to keep the table neat
      let guestRows = '';
      if (adults > 0) {
        guestRows += `
          <tr>
            <td style="padding:8px;border:1px solid #ddd;"><strong>Adults (21+)</strong></td>
            <td style="padding:8px;border:1px solid #ddd;">${adults}</td>
          </tr>
        `;
      }
      if (grandchildren > 0) {
        guestRows += `
          <tr>
            <td style="padding:8px;border:1px solid #ddd;"><strong>Grandchildren (21+)</strong></td>
            <td style="padding:8px;border:1px solid #ddd;">${grandchildren}</td>
          </tr>
        `;
      }
      if (youngPersons > 0) {
        guestRows += `
          <tr>
            <td style="padding:8px;border:1px solid #ddd;"><strong>16+ / Students</strong></td>
            <td style="padding:8px;border:1px solid #ddd;">${youngPersons}</td>
          </tr>
        `;
      }

      const html = `
        <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f9f9f9;padding:32px;">
          <table style="max-width:640px;margin:auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #eee;">
            <tr>
              <td style="background:#0f2b4c;color:#e7b333;padding:20px 24px;font-size:22px;font-weight:bold;">
                Cornerstones Booking Update
              </td>
            </tr>
            <tr>
              <td style="padding:24px;color:#333;line-height:1.6;">
                <p>Dear ${guest_name},</p>
                <p>
                  We are just doing a quick check-in as we get our system ready for the 2026 season. 
                  We want to reassure you that your stay is fully confirmed and secure!
                </p>
                
                <h3 style="color:#0f2b4c;margin-top:24px;">Your Details</h3>
                <table style="margin:20px 0;border-collapse:collapse;width:100%;">
                  <tr>
                    <td style="padding:8px;border:1px solid #ddd;width:50%;"><strong>Arrive</strong></td>
                    <td style="padding:8px;border:1px solid #ddd;">${arrive}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px;border:1px solid #ddd;"><strong>Depart</strong></td>
                    <td style="padding:8px;border:1px solid #ddd;">${depart}</td>
                  </tr>
                  ${guestRows}
                </table>

                <p>If any of these details look incorrect, or if you need to make changes to your guest count, please email <a href="mailto:shanevelez@gmail.com" style="color:#0f2b4c;font-weight:bold;">shanevelez@gmail.com</a>.</p>
                
                <p style="margin-top:30px;">We look forward to hosting you.</p>
                <p style="margin-bottom:0;">Richard and Louise</p>
              </td>
            </tr>
          </table>
        </div>
      `;

      // 🛑 DRY RUN: Sending everything to shanevelez@gmail.com
      await resend.emails.send({
        from: 'Cornerstones Booking <booking@cornerstonescrantock.com>',
        to: 'shanevelez@gmail.com', 
        subject: `DRY RUN: ${guest_name} - Cornerstones Booking Confirmed`,
        html,
      });

      sentCount++;
    }

    return res.status(200).json({ success: true, message: `Dry run complete! Sent ${sentCount} test emails to shanevelez@gmail.com.` });
    
  } catch (err) {
    return res.status(500).json({ error: 'Failed to process bulk emails', details: err.message });
  }
}
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
    const { bookingId, status, comment } = req.body;
    if (!bookingId || !status) {
      return res.status(400).json({ error: 'Missing bookingId or status' });
    }

    // ---- 1️⃣ Fetch booking + guest details ----
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (error || !booking) throw new Error('Booking not found');

    const { guest_name, guest_email, check_in, check_out, id: booking_id, cancel_token } = booking;
	
const isFamily = booking.family_member === true;

const pricingHtml = isFamily
  ? `
    <ul style="margin-left:20px;">
      <li>Adults (21 +) – £32 per person per night</li>
      <li>Grandchildren over 21 and in paid employment – £25 per person per night</li>
      <li>Young people 16 + / students – £12 per person per night</li>
      <li>Children under 16 – No charge</li>
      <li>Cleaning charge – £40 per booking</li>
    </ul>
  `
  : `
    <ul style="margin-left:20px;">
      <li>Adults (21 +) – £40 per person per night</li>
      <li>Young people 16 + / students – £12 per person per night</li>
      <li>Children under 16 – No charge</li>
      <li>Cleaning charge – £40 per booking</li>
    </ul>
  `;
	
const checkInYear = new Date(check_in).getFullYear();
const bookingNumber = `${checkInYear}${String(booking_id).padStart(2, '0')}`;
    // ---- 2️⃣ Build email HTML based on status ----
    let subject = '';
    let html = '';

    if (status === 'approved') {
      subject = 'Your Cornerstones Booking Confirmation';
      html = `
        <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f9f9f9;padding:32px;">
          <table style="max-width:640px;margin:auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #eee;">
            <tr>
              <td style="background:#0f2b4c;color:#e7b333;padding:20px 24px;font-size:22px;font-weight:bold;">
                Cornerstones Booking Confirmation
              </td>
            </tr>
            <tr>
              <td style="padding:24px;color:#333;line-height:1.6;">
                <p>Dear ${guest_name},</p>
                <p>
                  We’re delighted to confirm your stay at <strong>Cornerstones</strong>,
                  1 Gustory Road, Crantock, Cornwall TR8 5RG.
                </p>

                <table style="margin:20px 0;border-collapse:collapse;width:100%;">
                  <tr>
                    <td style="padding:8px;border:1px solid #ddd;"><strong>Booking number</strong></td>
                    <td style="padding:8px;border:1px solid #ddd;">${bookingNumber}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px;border:1px solid #ddd;"><strong>Arrive</strong></td>
                    <td style="padding:8px;border:1px solid #ddd;">${new Date(check_in).toLocaleDateString('en-GB')}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px;border:1px solid #ddd;"><strong>Depart</strong></td>
                    <td style="padding:8px;border:1px solid #ddd;">${new Date(check_out).toLocaleDateString('en-GB')}</td>
                  </tr>
                </table>

                <h3 style="color:#0f2b4c;margin-top:24px;">Your stay</h3>
${pricingHtml}

                <p style="margin-top:18px;">
                  Please transfer payment (including the cleaning charge) at least two weeks before your visit:
                </p>

                <div style="background:#f2deac;padding:12px 16px;border-radius:6px;margin:12px 0;">
                  <p style="margin:0;"><strong>Bank:</strong> HSBC</p>
                  <p style="margin:0;"><strong>Account Name:</strong> M Wills</p>
                  <p style="margin:0;"><strong>Sort Code:</strong> 40-10-00</p>
                  <p style="margin:0;"><strong>Account No.:</strong> 11064789</p>
                  <p style="margin:0;"><strong>Reference:</strong> Your booking number ${bookingNumber}</p>
                </div>

                <h3 style="color:#0f2b4c;margin-top:28px;">Arrival & Departure</h3>
                <p>Arrive after 4 pm and depart by 10 am to allow for cleaning.</p>
                <p>Keys are in a key-safe outside the kitchen door (code 2502). Please return them before leaving.</p>

                <h3 style="color:#0f2b4c;margin-top:28px;">During your stay</h3>
                <ul style="margin-left:20px;">
                  <li>Bring your own towels (bedding provided).</li>
                  <li>Bins collected early Monday — put out by 7 am at the bottom of the drive.</li>
                  <li>See the folder in the house for local info and parking guidance.</li>
                  <li>EV charging points – Crantock Village Hall and Esso garage (Newquay Road).</li>
                </ul>
<h3 style="color:#0f2b4c;margin-top:28px;">Parking</h3>
                <p style="margin-top:24px;">              
The drive at Cornerstones is spacious and parking locally in the summer is limited so we have a
Just Park space adjacent to the wall at the top of the drive. Just Park is an app that allows users to book parking spaces on residential properties. We offer a very small part of our drive to other tourists in the area.<BR><BR> We appreciate that this may be an
issue for some visitors particularly if bringing multiple vehicles. If you anticipate there being a
problem or you have any other questions about the Just Park space, please contact Eve Ashe on
07956 839713.
Further details are available in the information folder in the house.
                </p>

                <p style="margin-top:30px;">We hope you have a wonderful holiday.</p>
                <p style="margin-bottom:0;">Richard and Louise</p>
                
                <p style="font-size:14px;color:#555;">Cornerstones Bookings · 07717 132433 · millam@doctors.org.uk</p>
                <p style="margin-top:32px;">
  If you need to cancel your booking, please click below:<br>
 <a href="https://www.cornerstonescrantock.com/cancel/${cancel_token}"
     style="color:#0f2b4c;font-weight:600;text-decoration:underline;">
     Cancel this booking
  </a>
</p>

<p style="font-size:13px;color:#666;margin-top:8px;">
  This link is unique to your booking — please do not share it.
</p>
              </td>
            </tr>
            <tr>
              <td style="background:#0f2b4c;color:#e7b333;text-align:center;font-size:13px;padding:14px;">
                © ${new Date().getFullYear()} Cornerstones Crantock · Booking Confirmation
              </td>
            </tr>
          </table>
        </div>
      `;
    } else if (status === 'rejected') {
      subject = 'Your Cornerstones Booking Update';
      html = `
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
                  Thank you for your interest in staying at <strong>Cornerstones Crantock</strong>.
                  Unfortunately, your recent booking request for
                  <strong>${new Date(check_in).toLocaleDateString('en-GB')} – ${new Date(check_out).toLocaleDateString('en-GB')}</strong>
                  was <span style="color:#c00;font-weight:bold;">not approved</span>.
                </p>

                ${
                  comment
                    ? `<p><strong>Reason from the approver:</strong><br>${comment}</p>`
                    : ''
                }

                <p>You’re very welcome to check availability again at any time.</p>

                <p style="margin-top:32px;">With best wishes,<br>Cornerstones Family</p>
              </td>
            </tr>
            <tr>
              <td style="background:#f2deac;color:#0f2b4c;text-align:center;font-size:13px;padding:14px;">
                © ${new Date().getFullYear()} Cornerstones Crantock · Booking Update
              </td>
            </tr>
          </table>
        </div>
      `;
    } else {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    // ---- 3️⃣ Send via Resend ----
    await resend.emails.send({
      from: 'Cornerstones Booking <booking@cornerstonescrantock.com>',
      to: guest_email,
      subject,
      html,
    });

    return res.status(200).json({ success: true, sent: guest_email });
  } catch (err) {
    console.error('Email send error:', err);
    return res.status(500).json({ error: 'Failed to send booking email', details: err.message });
  }
}
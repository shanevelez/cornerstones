import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  // 🔐 1. Security Check (Vercel Cron)
  const authHeader = req.headers['authorization'];
  if (req.query.key !== process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const results = { cleaner: 0, guests: 0 };
    const today = new Date();

    // ============================================================
    // 🗓️ DATE CALCULATIONS
    // ============================================================
    
    // 1. Cleaner Trigger: 3 Days from now (Check-out date)
    const cleanerDate = new Date(today);
    cleanerDate.setDate(today.getDate() + 3);
    const cleanerTargetStr = cleanerDate.toISOString().split('T')[0];

    // 2. Guest Trigger: 7 Days from now (Check-in date)
    const guestDate = new Date(today);
    guestDate.setDate(today.getDate() + 7);
    const guestTargetStr = guestDate.toISOString().split('T')[0];

    // ============================================================
    // 🧹 TASK 1: REMIND CLEANER (3 Days Before Checkout)
    // ============================================================
    const { data: leavingBookings } = await supabase
      .from('bookings')
      .select('*')
      .eq('check_out', cleanerTargetStr)
      .eq('status', 'approved');

    if (leavingBookings && leavingBookings.length > 0) {
      // Fetch cleaner(s)
      const { data: cleaners } = await supabase
        .from('users')
        .select('email, name')
        .eq('role', 'Cleaner');

      if (cleaners && cleaners.length > 0) {
        const bookingListHtml = leavingBookings.map(b => 
          `<li><strong>${b.guest_name}</strong> - Checking out on ${new Date(b.check_out).toLocaleDateString('en-GB')}</li>`
        ).join('');

        const emailPromises = cleaners.map(cleaner => {
          return resend.emails.send({
            from: 'Cornerstones Admin <admin@cornerstonescrantock.com>',
            to: cleaner.email,
            subject: `🧹 Upcoming Checkout: ${new Date(cleanerTargetStr).toLocaleDateString('en-GB')}`,
            html: `
              <p>Hi ${cleaner.name || 'there'},</p>
              <p>Just a heads-up that the following guests are checking out in 3 days:</p>
              <ul>${bookingListHtml}</ul>
              <p>Please ensure the property is scheduled for cleaning.</p>
            `
          });
        });

        await Promise.all(emailPromises);
        results.cleaner = leavingBookings.length;
      }
    }

    // ============================================================
    // 🏖️ TASK 2: REMIND GUESTS (7 Days Before Check-in)
    // ============================================================
    const { data: arrivingBookings } = await supabase
      .from('bookings')
      .select('*')
      .eq('check_in', guestTargetStr)
      .eq('status', 'approved');

    if (arrivingBookings && arrivingBookings.length > 0) {
      const guestPromises = arrivingBookings.map(booking => {
        
        // 1. Calculate Booking Number
        const checkInYear = new Date(booking.check_in).getFullYear();
        const bookingNumber = `${checkInYear}${String(booking.id).padStart(2, '0')}`;

        // 2. Determine Pricing Logic (Family vs Regular)
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

        // 3. Build HTML
        const html = `
        <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f9f9f9;padding:32px;">
          <table style="max-width:640px;margin:auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #eee;">
            <tr>
              <td style="background:#0f2b4c;color:#e7b333;padding:20px 24px;font-size:22px;font-weight:bold;">
                Your Upcoming Stay at Cornerstones
              </td>
            </tr>
            <tr>
              <td style="padding:24px;color:#333;line-height:1.6;">
                <p>Dear ${booking.guest_name},</p>
                <p>
                  We are looking forward to welcoming you to <strong>Cornerstones</strong> next week!
                  Here is a quick reminder of your booking details and arrival information.
                </p>

                <table style="margin:20px 0;border-collapse:collapse;width:100%;">
                  <tr>
                    <td style="padding:8px;border:1px solid #ddd;"><strong>Booking number</strong></td>
                    <td style="padding:8px;border:1px solid #ddd;">${bookingNumber}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px;border:1px solid #ddd;"><strong>Arrive</strong></td>
                    <td style="padding:8px;border:1px solid #ddd;">${new Date(booking.check_in).toLocaleDateString('en-GB')}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px;border:1px solid #ddd;"><strong>Depart</strong></td>
                    <td style="padding:8px;border:1px solid #ddd;">${new Date(booking.check_out).toLocaleDateString('en-GB')}</td>
                  </tr>
                </table>

                <h3 style="color:#0f2b4c;margin-top:24px;">Your stay</h3>
                ${pricingHtml}

                <p style="margin-top:18px;">
                  If you haven't done so already, please ensure your balance is transferred before arrival:
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
                
                <p style="margin-top:32px; font-size:13px; color:#666;">
                  Need to view your booking? <a href="https://www.cornerstonescrantock.com/cancel/${booking.cancel_token}" style="color:#0f2b4c;">Click here</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="background:#0f2b4c;color:#e7b333;text-align:center;font-size:13px;padding:14px;">
                © ${new Date().getFullYear()} Cornerstones Crantock · Reminder
              </td>
            </tr>
          </table>
        </div>
        `;

        return resend.emails.send({
          from: 'Cornerstones Booking <booking@cornerstonescrantock.com>',
          to: booking.guest_email,
          subject: 'Your Cornerstones Holiday - One Week to Go!',
          html: html,
        });
      });

      await Promise.all(guestPromises);
      results.guests = arrivingBookings.length;
    }

    // ✅ Done
    return res.status(200).json({ success: true, ...results });

  } catch (err) {
    console.error('Cron error:', err);
    return res.status(500).json({ error: err.message });
  }
}
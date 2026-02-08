import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

// 🌍 CONFIGURATION FOR WEATHER ICONS
const ICON_BASE = 'https://www.cornerstonescrantock.com/images';
// 🔒 TEST CONFIGURATION
const TEST_EMAIL = 'shanevelez@gmail.com';

export default async function handler(req, res) {
  // 🔐 1. Security Check (Vercel Cron)
  const authHeader = req.headers['authorization'];
  if (req.query.key !== process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // 🛠️ DETECT TEST MODE
  const isTestMode = req.query.test === 'true';

  try {
    const results = { cleaner: 0, guests: 0, ray_alerts: 0, ray_skipped: false, mode: isTestMode ? 'TEST' : 'LIVE' };
    const today = new Date();

    // ============================================================
    // 🗓️ DATE CALCULATIONS (EXISTING)
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
    
    // 🛡️ SKIP IN TEST MODE
    if (!isTestMode) {
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
    }

    // ============================================================
    // 🏖️ TASK 2: REMIND GUESTS (7 Days Before Check-in)
    // ============================================================

    // 🛡️ SKIP IN TEST MODE
    if (!isTestMode) {
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
    }

    // ============================================================
    // ☀️ TASK 3: SEIZE THE RAY (Wednesdays Only)
    // ============================================================
    
    // UPDATED: Only run if today is Wednesday (3) OR if isTestMode is true
    if (today.getDay() === 3 || isTestMode) {
      
      // 1. Calculate the Target Window (Sat to Fri)
      // UPDATED: Now targeting THIS coming Saturday (3 days away) for higher accuracy
      const targetSat = new Date(today);
      targetSat.setDate(today.getDate() + 3);
      
      const targetFri = new Date(targetSat);
      targetFri.setDate(targetSat.getDate() + 6);

      // Strings for DB checks
      const checkInStr = targetSat.toISOString().split('T')[0];
      const checkOutStr = new Date(targetSat.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // Next Sat
      
      // Formatted Date for Email Header
      const dateOptionsLong = { weekday: 'long', day: 'numeric', month: 'long' };
      const headerDateRange = `${targetSat.toLocaleDateString('en-GB', dateOptionsLong)} – ${targetFri.toLocaleDateString('en-GB', dateOptionsLong)}`;

      // 2. Fetch Existing Bookings for this Week (Overlap check)
      const { data: bookings } = await supabase
        .from('bookings')
        .select('check_in, check_out')
        .eq('status', 'approved')
        .or(`check_in.lt.${checkOutStr},check_out.gt.${checkInStr}`); 

      // Helper: Is a specific date booked? (Occupancy Logic)
      const isDateBooked = (dateObj) => {
        const dateStr = dateObj.toISOString().split('T')[0];
        if (!bookings) return false;
        return bookings.some(b => b.check_in <= dateStr && b.check_out > dateStr);
      };

      // 3. Fetch Weather (Open-Meteo)
      // Note: We use 'forecast_days=16' to be safe, but we only use days 3-10
      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=50.40&longitude=-5.11&daily=weathercode,temperature_2m_max&timezone=Europe%2FLondon&forecast_days=16`
      );
      const weatherData = await weatherRes.json();

      // 4. Build Forecast
      const forecast = [];
      let availableSunnyDays = 0;

      // Icon Mapping
      const getWeatherIcon = (code) => {
        if ([0].includes(code)) return `${ICON_BASE}/sun.png`;             
        if ([1, 2].includes(code)) return `${ICON_BASE}/partcloud.png`;    
        if ([3, 45, 48].includes(code)) return `${ICON_BASE}/cloud.png`;  
        if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return `${ICON_BASE}/rain.png`; 
        return `${ICON_BASE}/storm.png`; 
      };

      // Loop 7 days (Sat - Fri)
      for (let i = 0; i < 7; i++) {
        const currentDay = new Date(targetSat);
        currentDay.setDate(targetSat.getDate() + i);
        const currentDayStr = currentDay.toISOString().split('T')[0];
        const wIndex = weatherData.daily.time.findIndex(t => t === currentDayStr);
        
        if (wIndex !== -1) {
          const code = weatherData.daily.weathercode[wIndex];
          const temp = Math.round(weatherData.daily.temperature_2m_max[wIndex]);
          const isSunny = [0, 1, 2].includes(code);
          const isBooked = isDateBooked(currentDay);

          if (isSunny && !isBooked) availableSunnyDays++;

          forecast.push({
            dayShort: currentDay.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase(),
            dateShort: currentDay.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
            temp,
            icon: getWeatherIcon(code),
            isSunny,
            isBooked
          });
        }
      }

      // 5. Trigger Email if 3+ Sunny & Available Days OR if isTestMode
      if (availableSunnyDays >= 3 || isTestMode) {
        
        let subscribers = [];

        // 🛡️ SWAP SUBSCRIBERS IN TEST MODE
        if (isTestMode) {
          subscribers = [{ email: TEST_EMAIL, name: 'Shane (Test)', id: 'TEST_USER' }];
        } else {
          const { data } = await supabase
            .from('subscribers')
            .select('email, name, id')
            .eq('status', 'active');
          subscribers = data || [];
        }

        if (subscribers && subscribers.length > 0) {
          
          // Generate Grid HTML
          const weatherGridHtml = forecast.map(day => {
            // A: BOOKED
            if (day.isBooked) {
              return `
                <td style="width:14.2%; text-align:center; vertical-align:bottom; background-color:#f3f4f6; border-radius:4px; padding:8px 0; opacity:0.6;">
                   <div style="font-size:10px; font-weight:bold; color:#999; text-transform:uppercase;">${day.dayShort}</div>
                   <div style="font-size:10px; color:#999; margin-bottom:4px;">${day.dateShort}</div>
                   <div style="height:50px; display:flex; align-items:center; justify-content:center; position:relative;">
                     <img src="${day.icon}" width="32" style="display:block; margin:0 auto; filter:grayscale(100%); opacity:0.5;" />
                   </div>
                   <div style="font-size:9px; font-weight:bold; color:#fff; background:#9ca3af; padding:2px 4px; border-radius:3px; display:inline-block; margin-top:2px;">BOOKED</div>
                </td>`;
            }
            // B: SUNNY & FREE
            if (day.isSunny) {
              return `
                <td style="width:14.2%; text-align:center; vertical-align:bottom; background-color:#fffbeb; border-radius:6px; border:2px solid #fcd34d; padding:8px 0;">
                   <div style="font-size:10px; font-weight:bold; color:#b45309; text-transform:uppercase;">${day.dayShort}</div>
                   <div style="font-size:10px; color:#b45309; margin-bottom:4px;">${day.dateShort}</div>
                   <div style="height:50px; display:flex; align-items:center; justify-content:center;">
                      <img src="${day.icon}" width="42" style="display:block; margin:0 auto;" />
                   </div>
                   <div style="font-size:14px; font-weight:bold; color:#b45309; margin-top:2px;">${day.temp}°</div>
                </td>`;
            }
            // C: DULL & FREE
            return `
                <td style="width:14.2%; text-align:center; vertical-align:bottom; border:1px solid #eee; border-radius:4px; padding:8px 0;">
                   <div style="font-size:10px; font-weight:bold; color:#666; text-transform:uppercase;">${day.dayShort}</div>
                   <div style="font-size:10px; color:#999; margin-bottom:4px;">${day.dateShort}</div>
                   <div style="height:50px; display:flex; align-items:center; justify-content:center;">
                      <img src="${day.icon}" width="42" style="display:block; margin:0 auto;" />
                   </div>
                   <div style="font-size:14px; font-weight:bold; color:#0f2b4c; margin-top:2px;">${day.temp}°</div>
                </td>`;
          }).join('');

          // Send to Subscribers
          const emailPromises = subscribers.map(sub => {
            return resend.emails.send({
              from: 'Seize the Ray <booking@cornerstonescrantock.com>',
              to: sub.email,
              subject: `☀️ Seize the Ray: Sunny week ahead in Crantock!`,
              html: `
              <!DOCTYPE html>
              <html>
              <head><meta charset="utf-8"><title>Seize the Ray</title></head>
              <body style="margin:0; padding:0; background-color:#f4f4f4;">
                <div style="font-family:'Segoe UI',Helvetica,Arial,sans-serif; background:#f9f9f9; padding:40px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; margin:auto; background:#fff; border-radius:8px; overflow:hidden; border:1px solid #e5e7eb; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                    <tr>
                      <td style="text-align:center; background-color:#fff; padding: 20px 0 0 0;">
                        <img src="${ICON_BASE}/Logo.png" alt="Cornerstones" width="180" style="width:180px; display:block; margin: 0 auto; border:none;" />
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:5px 32px 10px 32px; color:#333; line-height:1.6; text-align:center;">
                        <h2 style="color:#0f2b4c; margin-top:0; font-size:24px;">The Sun is Out! ☀️</h2>
                        <p style="font-size:16px; color:#555; margin-bottom: 5px;">
                          Hi ${sub.name || 'Friend'}, we've spotted a sunny gap in the calendar next week.
                        </p>
                        <p style="font-size:16px; color:#0f2b4c; margin: 10px 0;">
                          <strong>${headerDateRange}</strong>
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:10px 20px 30px 20px;">
                        <table width="100%" cellspacing="4" cellpadding="0" border="0" style="table-layout: fixed;">
                          <tr>${weatherGridHtml}</tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                       <td style="padding:0 32px 40px 32px; text-align:center; border-bottom:1px solid #f0f0f0;">
                          <a href="https://www.cornerstonescrantock.com" style="background-color:#f4b400; color:#0f2b4c; padding:14px 32px; text-decoration:none; font-weight:bold; border-radius:6px; font-size:16px; display:inline-block;">
                             Visit Cornerstones
                          </a>
                       </td>
                    </tr>
                    <tr>
                      <td style="background-color:#f9f9f9; padding:20px; text-align:center; color:#888; font-size:12px;">
                        <p>Cornerstones Crantock · 1 Gustory Road · Cornwall</p>
                        <p><a href="https://www.cornerstonescrantock.com/unsubscribe?id=${sub.id}" style="color:#888;">Unsubscribe from weather alerts</a></p>
                      </td>
                    </tr>
                  </table>
                </div>
              </body>
              </html>
              `
            });
          });

          await Promise.all(emailPromises);
          results.ray_alerts = subscribers.length;
        }
      }
    } else {
      results.ray_skipped = true; // Not Wednesday
    }

    // ✅ Done
    return res.status(200).json({ success: true, ...results });

  } catch (err) {
    console.error('Cron error:', err);
    return res.status(500).json({ error: err.message });
  }
}
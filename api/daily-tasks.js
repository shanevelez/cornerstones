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
  console.log('--- CRON INITIALIZED ---');
  console.log('Query parameters received:', req.query);
  console.log('Authorization Header Present:', !!req.headers['authorization']);

  // 🔐 1. Security Check (Vercel Cron)
  const authHeader = req.headers['authorization'];
  if (req.query.key !== process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn('❌ Security Check Failed: Unauthorized access attempt.');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  console.log('✅ Security Check Passed.');

  // 🛠️ DETECT TEST MODE
  const isTestMode = req.query.test === 'true';
  console.log('Execution Mode:', isTestMode ? 'TEST' : 'LIVE');

  try {
    const results = { cleaner: 0, guests: 0, ray_alerts: 0, ray_skipped: false, mode: isTestMode ? 'TEST' : 'LIVE' };
    const today = new Date();
    console.log(`Current Clock Time (today): ${today.toISOString()} | Local: ${today.toString()}`);

    // ============================================================
    // 🗓️ DATE CALCULATIONS
    // ============================================================
    
    // 1. Cleaner Trigger: 3 Days from now (Check-out date)
    const cleanerDate = new Date(today);
    cleanerDate.setDate(today.getDate() + 3);
    const cleanerTargetStr = cleanerDate.toISOString().split('T')[0];
    console.log(`Calculated cleanerTargetStr (3 days out): "${cleanerTargetStr}"`);

    // 2. Guest Trigger: 7 Days from now (Check-in date)
    const guestDate = new Date(today);
    guestDate.setDate(today.getDate() + 6);
    const guestTargetStr = guestDate.toISOString().split('T')[0];
    console.log(`Calculated guestTargetStr (7 days out): "${guestTargetStr}"`);

    // ============================================================
    // 🧹 TASK 1: REMIND CLEANER (3 Days Before Checkout)
    // ============================================================
    console.log('--- STARTING TASK 1: CLEANER REMINDERS ---');
    if (!isTestMode) {
      console.log(`Querying bookings where check_out = "${cleanerTargetStr}" AND status = "approved"`);
      const { data: leavingBookings, error: cleanerBookingsError } = await supabase
        .from('bookings')
        .select('*')
        .eq('check_out', cleanerTargetStr)
        .eq('status', 'approved');

      if (cleanerBookingsError) console.error('Supabase error fetching leaving bookings:', cleanerBookingsError);
      console.log('Leaving bookings retrieved count:', leavingBookings ? leavingBookings.length : 0);

      if (leavingBookings && leavingBookings.length > 0) {
        console.log('Leaving Bookings Raw Data:', JSON.stringify(leavingBookings, null, 2));
        console.log('Querying users where role = "Cleaner"');
        
        const { data: cleaners, error: cleanersError } = await supabase
          .from('users')
          .select('email, name')
          .eq('role', 'Cleaner');

        if (cleanersError) console.error('Supabase error fetching cleaners:', cleanersError);
        console.log('Cleaners retrieved count:', cleaners ? cleaners.length : 0);

        if (cleaners && cleaners.length > 0) {
          console.log('Cleaners Raw Data:', JSON.stringify(cleaners, null, 2));
          
          const bookingListHtml = leavingBookings.map(b => 
            `<li><strong>${b.guest_name}</strong> - Checking out on ${new Date(b.check_out + 'T12:00:00').toLocaleDateString('en-GB')}</li>`
          ).join('');

          const emailPromises = cleaners.map(cleaner => {
            console.log(`Queueing cleaner email to: ${cleaner.email}`);
            return resend.emails.send({
              from: 'Cornerstones Admin <admin@cornerstonescrantock.com>',
              to: cleaner.email,
              subject: `🧹 Upcoming Checkout: ${new Date(cleanerTargetStr + 'T12:00:00').toLocaleDateString('en-GB')}`,
              html: `
                <p>Hi ${cleaner.name || 'there'},</p>
                <p>Just a heads-up that the following guests are checking out in 3 days:</p>
                <ul>${bookingListHtml}</ul>
                <p>Please ensure the property is scheduled for cleaning.</p>
              `
            });
          });

          console.log('Resolving cleaner email promises...');
          await Promise.all(emailPromises);
          console.log('All cleaner emails processed.');
          results.cleaner = leavingBookings.length;
        }
      }
    } else {
      console.log('Skipping Task 1: Cleaner Reminders are disabled in Test Mode.');
    }

    // ============================================================
    // 🏖️ TASK 2: REMIND GUESTS (7 Days Before Check-in)
    // ============================================================
    console.log('--- STARTING TASK 2: GUEST REMINDERS ---');
    if (!isTestMode) {
      console.log(`Querying bookings where check_in = "${guestTargetStr}" AND status = "approved"`);
      const { data: arrivingBookings, error: guestBookingsError } = await supabase
        .from('bookings')
        .select('*')
        .eq('check_in', guestTargetStr)
        .eq('status', 'approved');

      if (guestBookingsError) console.error('Supabase error fetching arriving bookings:', guestBookingsError);
      console.log('Arriving bookings retrieved count:', arrivingBookings ? arrivingBookings.length : 0);

      if (arrivingBookings && arrivingBookings.length > 0) {
        console.log('Arriving Bookings Raw Data:', JSON.stringify(arrivingBookings, null, 2));
        console.log('Querying public.rates configuration rows...');
        
        const { data: rateRecords, error: ratesError } = await supabase
          .from('rates')
          .select('guest_type, rate_per_night, is_family, start_date, end_date');

        if (ratesError) console.error('Supabase error fetching rate records:', ratesError);
        console.log('Rate records database rows count:', rateRecords ? rateRecords.length : 0);

        if (ratesError || !rateRecords) {
          console.error('Task 2 Aborted: Crashing via throw rule due to missing configuration records.');
          throw new Error('Failed to find active configuration records database rows.');
        }
        console.log('Rates Records Raw Data:', JSON.stringify(rateRecords, null, 2));

        const guestPromises = arrivingBookings.map((booking, idx) => {
          console.log(`Processing mapping logic for booking index [${idx}], ID: ${booking.id}, Guest: ${booking.guest_name}`);
          
          const start = new Date(booking.check_in + 'T12:00:00');
          const end = new Date(booking.check_out + 'T12:00:00');
          console.log(`Mapped ISO Date Objects - Start: ${start.toISOString()} | End: ${end.toISOString()}`);
          
          const nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) || 1;
          console.log(`Calculated nights duration parameter: ${nights}`);
          
          const checkInYear = start.getFullYear();
          const bookingNumber = `${checkInYear}${String(booking.id).padStart(2, '0')}`;
          console.log(`Generated booking identifier hash string: ${bookingNumber}`);

          const isFamily = booking.family_member === true;
          const finalBalance = booking.total_paid || 0;
          console.log(`Flags checked - isFamily: ${isFamily} | total_paid parsed balance: ${finalBalance}`);

          console.log(`Filtering active rate matrix bounds for booking: "${booking.check_in}"...`);
          const activeRates = rateRecords.filter((r, rIdx) => {
            if (r.is_family !== isFamily) return false;
            const startValid = r.start_date <= booking.check_in;
            const endValid = !r.end_date || r.end_date >= booking.check_in;
            const matchResult = startValid && endValid;
            
            console.log(`Rate row [${rIdx}] (${r.guest_type}) match debug -> startValid: ${startValid} (${r.start_date} <= ${booking.check_in}), endValid: ${endValid} (${r.end_date} >= ${booking.check_in}). Evaluates: ${matchResult}`);
            return matchResult;
          });
          console.log(`Total matching configuration rules filtered down to memory: ${activeRates.length}`);

          const rateMap = activeRates.reduce((acc, r) => {
            acc[r.guest_type] = Number(r.rate_per_night);
            return acc;
          }, {});
          console.log('Compiled runtime rateMap values:', JSON.stringify(rateMap));

          const adultRate = rateMap['adult'] ?? (isFamily ? 32 : 40);
          const grandChildRate = rateMap['grandchild_over21'] ?? (isFamily ? 25 : 40);
          const youngPersonRate = rateMap['young_person'] ?? 12;
          const CLEANING_FEE = rateMap['cleaning'] ?? 40;
          console.log(`Fallback thresholds evaluated: adult=${adultRate}, grandchild=${grandChildRate}, young=${youngPersonRate}, cleaning=${CLEANING_FEE}`);

          const pricingHtml = `
            <ul style="margin-left:20px; color:#333;">
              <li>Adults (21+): ${booking.adults || 0} x £${adultRate} per night</li>
              ${booking.grandchildren_over21 > 0 ? `<li>Grandchildren (21+): ${booking.grandchildren_over21} x £${grandChildRate} per night</li>` : ''}
              ${((booking.children_16plus || 0) + (booking.students || 0)) > 0 ? `<li>16+ / Students: ${((booking.children_16plus || 0) + (booking.students || 0))} x £${youngPersonRate} per night</li>` : ''}
              <li>Cleaning charge: £${CLEANING_FEE}</li>
              <li style="margin-top:10px; list-style:none;"><strong>Total for ${nights} nights: £${finalBalance}</strong></li>
            </ul>
          `;

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
                      <td style="padding:8px;border:1px solid #ddd;">${start.toLocaleDateString('en-GB')}</td>
                    </tr>
                    <tr>
                      <td style="padding:8px;border:1px solid #ddd;"><strong>Depart</strong></td>
                      <td style="padding:8px;border:1px solid #ddd;">${end.toLocaleDateString('en-GB')}</td>
                    </tr>
                    <tr>
                      <td style="padding:8px;border:1px solid #ddd;"><strong>Total Balance</strong></td>
                      <td style="padding:8px;border:1px solid #ddd;"><strong>£${finalBalance}</strong></td>
                    </tr>
                  </table>

                  <h3 style="color:#0f2b4c;margin-top:24px;">Your stay</h3>
                  ${pricingHtml}

                  <p style="font-size:14px; color:#666; font-style:italic; margin-top:12px;">
                    The total cost is calculated based on the number and type of guests you entered when making the initial booking. 
                    If more or less people are coming, please add or subtract their costs to the calculation.
                  </p>

                  <p style="margin-top:18px;">
                    If you haven't done so already, please ensure your balance is transferred before arrival:
                  </p>

                  <div style="background:#f2deac;padding:12px 16px;border-radius:6px;margin:12px 0;">
                    <p style="margin:0;"><strong>Bank:</strong> HSBC</p>
                    <p style="margin:0;"><strong>Account Name:</strong> M Wills</p>
                    <p style="margin:0;"><strong>Sort Code:</strong> 40-10-00</p>
                    <p style="margin:0;"><strong>Account No.:</strong> 11064789</p>
                    <p style="margin:0;"><strong>Reference:</strong> ${bookingNumber}</p>
                  </div>

                  <h3 style="color:#0f2b4c;margin-top:28px;">Arrival & Departure</h3>
                  <p>Arrive after 4 pm and depart by 10 am to allow for cleaning.</p>
                  <p>Keys are in a key-safe outside the kitchen door (code 2502). Please return them before leaving.</p>

                  <h3 style="color:#0f2b4c;margin-top:28px;">During your stay</h3>
                  <ul style="margin-left:20px;">
                    ${!isFamily ? '<li>Bring your own towels (bedding provided).</li>' : ''}
                    <li>Bins collected early Monday — put out by 7 am at the bottom of the drive.</li>
                    <li>See the folder in the house for local info and parking guidance.</li>
                    <li>EV charging points – Crantock Village Hall and Esso garage (Newquay Road).</li>
                    <li><a href="https://www.cornerstonescrantock.com/local-recs">Check here</a> for local recommendations made by our guests and please do submit your own!</li>
                  </ul>

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

          console.log(`Dispatching API call to Resend endpoint for guest email: ${booking.guest_email}`);
          return resend.emails.send({
            from: 'Cornerstones Booking <booking@cornerstonescrantock.com>',
            to: booking.guest_email,
            subject: `Your Cornerstones Holiday - £${finalBalance} Balance Reminder`,
            html: html,
          });
        });

        console.log('Resolving guest reminder promises via Promise.all...');
        await Promise.all(guestPromises);
        console.log('All guest notification attempts executed.');
        results.guests = arrivingBookings.length;
      }
    } else {
      console.log('Skipping Task 2: Guest Reminders bypassed while running in Test Mode configuration.');
    }

    // ============================================================
    // ☀️ TASK 3: SEIZE THE RAY (Wednesdays Only)
    // ============================================================
    console.log('--- STARTING TASK 3: SEIZE THE RAY ---');
    console.log(`Current Day Index evaluated: ${today.getDay()} (Wednesday is 3)`);
    
    if (today.getDay() === 3 || isTestMode) {
      const targetSat = new Date(today);
      targetSat.setDate(today.getDate() + 3);
      
      const targetFri = new Date(targetSat);
      targetFri.setDate(targetSat.getDate() + 6);

      const checkInStr = targetSat.toISOString().split('T')[0];
      const checkOutStr = new Date(targetSat.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; 
      console.log(`Seize the Ray Window string criteria -> check_in search lower bound: "${checkInStr}", check_out upper bound: "${checkOutStr}"`);
      
      const dateOptionsLong = { weekday: 'long', day: 'numeric', month: 'long' };
      const headerDateRange = `${targetSat.toLocaleDateString('en-GB', dateOptionsLong)} – ${targetFri.toLocaleDateString('en-GB', dateOptionsLong)}`;

      console.log('Querying conflicting approved bookings from database matrix range...');
      const { data: bookings, error: rayBookingsError } = await supabase
        .from('bookings')
        .select('check_in, check_out')
        .eq('status', 'approved')
        .or(`check_in.lt.${checkOutStr},check_out.gt.${checkInStr}`); 

      if (rayBookingsError) console.error('Supabase error fetching range matches for weather window:', rayBookingsError);
      console.log('Overlapping range bookings returned count:', bookings ? bookings.length : 0);

      const isDateBooked = (dateObj) => {
        const dateStr = dateObj.toISOString().split('T')[0];
        if (!bookings) return false;
        return bookings.some(b => b.check_in <= dateStr && b.check_out > dateStr);
      };

      console.log('Fetching Open-Meteo API weather coordinate maps...');
      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=50.40&longitude=-5.11&daily=weathercode,temperature_2m_max&timezone=Europe%2FLondon&forecast_days=16`
      );
      const weatherData = await weatherRes.json();
      console.log('Open-Meteo response structure verified:', !!weatherData, 'Daily attributes defined:', !!weatherData?.daily);

      const forecast = [];
      let availableSunnyDays = 0;

      const getWeatherIcon = (code) => {
        if ([0].includes(code)) return `${ICON_BASE}/sun.png`;             
        if ([1, 2].includes(code)) return `${ICON_BASE}/partcloud.png`;    
        if ([3, 45, 48].includes(code)) return `${ICON_BASE}/cloud.png`;  
        if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return `${ICON_BASE}/rain.png`; 
        return `${ICON_BASE}/storm.png`; 
      };

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
      console.log(`Calculated summary for weather loop -> Available Sunny Days: ${availableSunnyDays}`);

      console.log(`Checking alert execution flags -> availableSunnyDays >= 3: ${availableSunnyDays >= 3} || isTestMode: ${isTestMode}`);
      if (availableSunnyDays >= 3 || isTestMode) {
        let subscribers = [];

        if (isTestMode) {
          subscribers = [{ email: TEST_EMAIL, name: 'Shane (Test)', id: 'TEST_USER' }];
        } else {
          console.log('Querying public active email subscriber entities...');
          const { data, error: subError } = await supabase
            .from('subscribers')
            .select('email, name, id')
            .eq('status', 'active');
          if (subError) console.error('Supabase error fetching subscriber mailing arrays:', subError);
          subscribers = data || [];
        }
        console.log('Total targeted subscribers map allocation:', subscribers.length);

        if (subscribers && subscribers.length > 0) {
          const weatherGridHtml = forecast.map(day => {
            if (day.isBooked) {
              return `
                <td style="width:14.2%; text-align:center; vertical-align:bottom; background-color:#f3f4f6; border-radius:4px; padding:8px 0; opacity:0.6;">
                   <div style="font-size:10px; font-weight:bold; color:#999; text-transform:uppercase;">${day.dayShort}</div>
                   <div style="font-size:10px; color:#999; margin-bottom:4px;">${day.dateShort}</div>
                   <div style="padding: 5px 0;">
                     <img src="${day.icon}" style="display:block; margin:0 auto; width:50%; max-width:22px; height:auto; filter:grayscale(100%); opacity:0.5;" />
                   </div>
                   <div style="font-size:9px; font-weight:bold; color:#fff; background:#9ca3af; padding:2px 4px; border-radius:3px; display:inline-block; margin-top:2px;">BOOKED</div>
                </td>`;
            }
            if (day.isSunny) {
              return `
                <td style="width:14.2%; text-align:center; vertical-align:bottom; background-color:#fffbeb; border-radius:6px; border:2px solid #fcd34d; padding:8px 0;">
                   <div style="font-size:10px; font-weight:bold; color:#b45309; text-transform:uppercase;">${day.dayShort}</div>
                   <div style="font-size:10px; color:#b45309; margin-bottom:4px;">${day.dateShort}</div>
                   <div style="padding: 5px 0;">
                      <img src="${day.icon}" style="display:block; margin:0 auto; width:60%; max-width:42px; height:auto;" />
                   </div>
                   <div style="font-size:14px; font-weight:bold; color:#b45309; margin-top:2px;">${day.temp}°</div>
                </td>`;
            }
            return `
                <td style="width:14.2%; text-align:center; vertical-align:bottom; border:1px solid #eee; border-radius:4px; padding:8px 0;">
                   <div style="font-size:10px; font-weight:bold; color:#666; text-transform:uppercase;">${day.dayShort}</div>
                   <div style="font-size:10px; color:#999; margin-bottom:4px;">${day.dateShort}</div>
                   <div style="padding: 5px 0;">
                      <img src="${day.icon}" style="display:block; margin:0 auto; width:60%; max-width:42px; height:auto;" />
                   </div>
                   <div style="font-size:14px; font-weight:bold; color:#0f2b4c; margin-top:2px;">${day.temp}°</div>
                </td>`;
          }).join('');

          const emailPromises = subscribers.map(sub => {
            console.log(`Queueing weather alert email distribution bound to: ${sub.email}`);
            return resend.emails.send({
              from: 'Seize the Ray <booking@cornerstonescrantock.com>',
              to: sub.email,
              subject: `${isTestMode ? '[TEST] ' : ''}☀️ Seize the Ray: Sunny week ahead in Crantock!`,
              html: `
              <!DOCTYPE html>
              <html>
              <head><meta charset="utf-8"><title>Seize the Ray</title></head>
              <body style="margin:0; padding:0; background-color:#f4f4f4;">
                <div style="font-family:'Segoe UI',Helvetica,Arial,sans-serif; background:#f9f9f9; padding:40px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; margin:auto; background:#fff; border-radius:8px; overflow:hidden; border:1px solid #e5e7eb;">
                    <tr>
                      <td style="text-align:center; background-color:#fff; padding: 20px 0 0 0;">
                        <img src="${ICON_BASE}/Logo.png" alt="Cornerstones" width="180" style="width:180px; display:block; margin: 0 auto;" />
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:5px 32px 10px 32px; color:#333; line-height:1.6; text-align:center;">
                        <h2 style="color:#0f2b4c; margin-top:0; font-size:24px;">The Sun is Out! ☀️</h2>
                        <p style="font-size:16px; color:#555;">Hi ${sub.name || 'Friend'}, we've spotted a sunny gap in the calendar next week.</p>
                        <p style="font-size:16px; color:#0f2b4c; margin: 10px 0;"><strong>${headerDateRange}</strong></p>
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
                       <td style="padding:0 32px 40px 32px; text-align:center;">
                          <a href="https://www.cornerstonescrantock.com" style="background-color:#f4b400; color:#0f2b4c; padding:14px 32px; text-decoration:none; font-weight:bold; border-radius:6px; display:inline-block;">Visit Cornerstones</a>
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
              </html>`
            });
          });

          console.log('Resolving weather email promises via Promise.all...');
          await Promise.all(emailPromises);
          console.log('All weather alert subscriber emails processed.');
          results.ray_alerts = subscribers.length;
        }
      }
    } else {
      console.log('Skipping Task 3: It is not Wednesday and Test Mode is inactive.');
      results.ray_skipped = true;
    }

    console.log('Execution completed smoothly. Final response tracking values:', JSON.stringify(results));
    return res.status(200).json({ success: true, ...results });
  } catch (err) {
    console.error('🛑 HARD ERROR INTERCEPTED IN CATCH BLOCK:', err);
    console.error('Error message string properties:', err.message);
    console.error('Detailed Error Execution Context Stacktrace:', err.stack);
    return res.status(500).json({ error: err.message });
  }
}
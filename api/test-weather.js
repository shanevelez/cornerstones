import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

// 🌍 CONFIGURATION
const ICON_BASE = 'https://www.cornerstonescrantock.com/images';
const TEST_EMAIL = 'shanevelez@gmail.com'; // 🔒 SAFETY: Only send here

export default async function handler(req, res) {
  try {
    const today = new Date();

    // ============================================================
    // 🗓️ DATE SETUP (Same as original)
    // ============================================================
    // Target the coming Saturday (3 days from now) just like the real script
    const targetSat = new Date(today);
    targetSat.setDate(today.getDate() + 3);
    
    const targetFri = new Date(targetSat);
    targetFri.setDate(targetSat.getDate() + 6);

    const checkInStr = targetSat.toISOString().split('T')[0];
    const checkOutStr = new Date(targetSat.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // Formatted Date for Email Header
    const dateOptionsLong = { weekday: 'long', day: 'numeric', month: 'long' };
    const headerDateRange = `${targetSat.toLocaleDateString('en-GB', dateOptionsLong)} – ${targetFri.toLocaleDateString('en-GB', dateOptionsLong)}`;

    // ============================================================
    // 🔍 1. CHECK BOOKINGS (To test "BOOKED" logic)
    // ============================================================
    const { data: bookings } = await supabase
      .from('bookings')
      .select('check_in, check_out')
      .eq('status', 'approved')
      .or(`check_in.lt.${checkOutStr},check_out.gt.${checkInStr}`); 

    const isDateBooked = (dateObj) => {
      const dateStr = dateObj.toISOString().split('T')[0];
      if (!bookings) return false;
      return bookings.some(b => b.check_in <= dateStr && b.check_out > dateStr);
    };

    // ============================================================
    // ☁️ 2. FETCH WEATHER (Real Data)
    // ============================================================
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=50.40&longitude=-5.11&daily=weathercode,temperature_2m_max&timezone=Europe%2FLondon&forecast_days=16`
    );
    const weatherData = await weatherRes.json();

    // ============================================================
    // 📊 3. BUILD FORECAST GRID
    // ============================================================
    const forecast = [];

    const getWeatherIcon = (code) => {
      if ([0].includes(code)) return `${ICON_BASE}/sun.png`;             
      if ([1, 2].includes(code)) return `${ICON_BASE}/partcloud.png`;    
      if ([3, 45, 48].includes(code)) return `${ICON_BASE}/cloud.png`;  
      if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return `${ICON_BASE}/rain.png`; 
      return `${ICON_BASE}/storm.png`; 
    };

    // Loop 7 days
    for (let i = 0; i < 7; i++) {
      const currentDay = new Date(targetSat);
      currentDay.setDate(targetSat.getDate() + i);
      const currentDayStr = currentDay.toISOString().split('T')[0];
      const wIndex = weatherData.daily.time.findIndex(t => t === currentDayStr);
      
      if (wIndex !== -1) {
        const code = weatherData.daily.weathercode[wIndex];
        const temp = Math.round(weatherData.daily.temperature_2m_max[wIndex]);
        const isSunny = [0, 1, 2].includes(code); // Keeping logic to show sunny styling
        const isBooked = isDateBooked(currentDay);

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

    // ============================================================
    // 📧 4. GENERATE EMAIL (Forced)
    // ============================================================
    
    // Generate Grid HTML (Identical to original)
    const weatherGridHtml = forecast.map(day => {
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

    // Send ONLY to the Test Email
    const emailResponse = await resend.emails.send({
      from: 'Seize the Ray <booking@cornerstonescrantock.com>',
      to: TEST_EMAIL,
      subject: `☀️ TEST: Seize the Ray Weather Report`,
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
                <h2 style="color:#0f2b4c; margin-top:0; font-size:24px;">TEST REPORT: Weather Check ☀️</h2>
                <p style="font-size:16px; color:#555; margin-bottom: 5px;">
                  Hi Shane, this is a forced weather check.
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
                <p>This is a test email.</p>
              </td>
            </tr>
          </table>
        </div>
      </body>
      </html>
      `
    });

    return res.status(200).json({ 
      success: true, 
      message: 'Test email sent to ' + TEST_EMAIL, 
      weather_data_preview: forecast,
      email_id: emailResponse.id
    });

  } catch (err) {
    console.error('Test error:', err);
    return res.status(500).json({ error: err.message });
  }
}
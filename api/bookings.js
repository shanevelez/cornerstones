import { Pool } from 'pg';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

let pool;

function getPool() {
  if (!pool) {
    const certPath = path.join(process.cwd(), 'certs', 'prod-ca-2021.crt');
    const caCert = fs.readFileSync(certPath).toString();

    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: true,
        ca: caCert,
      },
    });
  }
  return pool;
}

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const {
        seniors,
        guest_name,
        guest_email,
        check_in,
        check_out,
        adults,
        grandchildren_over21,
        children_16plus,
        students,
        family_member
      } = req.body;
      
      if (seniors) {
        return res.status(200).json({ success: true });
      }

      if (!guest_name || !guest_email || !check_in || !check_out) {
        return res.status(400).json({ error: 'Missing required fields.' });
      }

      const db = getPool();

      // Normalize local input variables
      const isFamily = family_member ?? false;
      const numAdults = adults ?? 0;
      const numGrandchildren = grandchildren_over21 ?? 0;
      const numChildren16Plus = children_16plus ?? 0;
      const numStudents = students ?? 0;

      // Calculate pure calendar duration boundaries
      const fromDate = new Date(check_in + 'T12:00:00');
      const toDate = new Date(check_out + 'T12:00:00');
      const stayNights = Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24)) || 1;

      // 1. 🆕 SOURCING CURRENT ACTIVE METRICS FROM THE RATES ARCHITECTURE
      const ratesQuery = `
        SELECT guest_type, rate_per_night 
        FROM rates 
        WHERE is_family = $1 
          AND start_date <= $2 
          AND (end_date IS NULL OR end_date >= $2);
      `;
      const { rows: rateRecords } = await db.query(ratesQuery, [isFamily, check_in]);

      // Reduce pricing blocks matrix down to a tracking map lookup object
      const pricingMap = rateRecords.reduce((acc, curr) => {
        acc[curr.guest_type] = Number(curr.rate_per_night);
        return acc;
      }, {});

      // Apply safe architectural fallback baselines matching database configurations
      const adultRate = pricingMap['adult'] ?? (isFamily ? 32 : 40);
      const grandchildRate = pricingMap['grandchild_over21'] ?? (isFamily ? 25 : 40);
      const youngRate = pricingMap['young_person'] ?? 12;
      const cleanRate = pricingMap['cleaning'] ?? 40;

      // 2. Compute true billing matrix parameters
      const adultsTotal = numAdults * adultRate * stayNights;
      const grandTotal = numGrandchildren * grandchildRate * stayNights;
      const youngTotal = (numChildren16Plus + numStudents) * youngRate * stayNights;
      const computedTotalPaid = adultsTotal + grandTotal + youngTotal + cleanRate;

      // Build out JSON structural metadata payload block
      const computedBreakdown = {
        cleaning: cleanRate,
        adults: { count: numAdults, rate: adultRate, total: adultsTotal },
        grandchildren: { count: numGrandchildren, rate: grandchildRate, total: grandTotal },
        young: { count: (numChildren16Plus + numStudents), rate: youngRate, total: youngTotal }
      };

      const cancelToken = crypto.randomBytes(24).toString('hex');

      // 3. Inject calculated values right inside the standard insertion sequence
      const query = `
        INSERT INTO bookings (
          guest_name,
          guest_email,
          check_in,
          check_out,
          adults,
          grandchildren_over21,
          children_16plus,
          students,
          family_member,
          cancel_token,
          total_paid,
          breakdown
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        RETURNING *;
      `;

      const values = [
        guest_name,
        guest_email,
        check_in,
        check_out,
        numAdults,
        numGrandchildren,
        numChildren16Plus,
        numStudents,
        isFamily,
        cancelToken,
        computedTotalPaid,
        JSON.stringify(computedBreakdown) // Cast to string to safely insert into JSONB
      ];

      const { rows } = await db.query(query, values);
      const newBooking = rows[0];

      try {
        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/notify-approvers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingId: newBooking.id,
            guest_name: newBooking.guest_name,
            check_in: newBooking.check_in,
            check_out: newBooking.check_out
          })
        });
      } catch (emailErr) {
        console.error('Email notification failed');
      }

      return res.status(200).json({ success: true, booking: newBooking });
    } catch (error) {
      console.error('Insert error:', error);
      return res.status(500).json({ error: 'Failed to save booking.' });
    }
  }

  res.setHeader('Allow', ['POST']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}
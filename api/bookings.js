import { Pool } from 'pg';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Initialize pool outside to allow connection reuse across warm invocations
let pool;

function getPool() {
  if (!pool) {
    const certPath = path.join(process.cwd(), 'certs', 'prod-ca-2021.crt');
    const caCert = fs.readFileSync(certPath).toString();

    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: true, // Verification is now ENABLED
        ca: caCert,               // Use the certificate you just downloaded
      },
    });
  }
  return pool;
}

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const {
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

      if (!guest_name || !guest_email || !check_in || !check_out) {
        return res.status(400).json({ error: 'Missing required fields.' });
      }

      const cancelToken = crypto.randomBytes(24).toString('hex');

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
          cancel_token
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING *;
      `;

      const values = [
        guest_name,
        guest_email,
        check_in,
        check_out,
        adults ?? 0,
        grandchildren_over21 ?? 0,
        children_16plus ?? 0,
        students ?? 0,
        family_member ?? false,
        cancelToken
      ];

      const db = getPool();
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
      console.error('Insert error');
      return res.status(500).json({ error: 'Failed to save booking.' });
    }
  }

  res.setHeader('Allow', ['POST']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}
import { Pool } from 'pg';
import crypto from 'crypto';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

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

      const { rows } = await pool.query(query, values);
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
        console.error('Email notification failed:', emailErr);
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

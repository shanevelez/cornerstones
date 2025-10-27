console.log('Database URL value:', process.env.DATABASE_URL);
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Supabase requires SSL
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
          family_member
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
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
        family_member ?? false
      ];

      const { rows } = await pool.query(query, values);
      const newBooking = rows[0];

      // ✅ NEW: Trigger Resend email notification
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
  } else if (req.method === 'GET') {
    try {
      const { rows } = await pool.query(
        'SELECT * FROM bookings ORDER BY created_at DESC'
      );
      return res.status(200).json(rows);
    } catch (error) {
      console.error('Fetch error:', error);
      return res.status(500).json({ error: 'Failed to load bookings.' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

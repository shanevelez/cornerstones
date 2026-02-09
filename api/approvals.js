import { Pool } from 'pg';
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
        rejectUnauthorized: true,
        ca: caCert,
      },
    });
  }
  return pool;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { booking_id, user_id, action, comment } = req.body;

    // SECURITY FIX: Removed console.log that exposed booking_id and user_id in logs

    if (!booking_id || !user_id || !action) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const db = getPool();
    const client = await db.connect();

    try {
      await client.query('BEGIN');

      const update = `
        UPDATE bookings
        SET status = $1
        WHERE id = $2
        RETURNING *;
      `;
      const { rows: updated } = await client.query(update, [action, booking_id]);
      if (!updated.length) throw new Error('Booking not found.');

      const insert = `
        INSERT INTO approvals (booking_id, user_id, action, comment)
        VALUES ($1, $2, $3, $4)
        RETURNING *;
      `;
      const { rows: approval } = await client.query(insert, [
        booking_id,
        user_id,
        action,
        comment || null,
      ]);

      await client.query('COMMIT');

      // Trigger email notification
      try {
        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/send-booking-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingId: booking_id,
            status: action,
            comment: comment || '',
          }),
        });
      } catch (emailErr) {
        // Log generic error without sensitive data
        console.error('Notification failed');
      }

      res.status(200).json({
        success: true,
        booking: updated[0],
        approval: approval[0],
      });
    } catch (txErr) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: 'Failed to record approval.' });
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ error: 'Unexpected server error.' });
  }
}
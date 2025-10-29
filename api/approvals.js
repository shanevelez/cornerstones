import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { booking_id, user_id, action, comment } = req.body;
    console.log('SERVER RECEIVED â†’', { booking_id, user_id, action });


    if (!booking_id || !user_id || !action) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1ï¸âƒ£ Update booking status
      const update = `
        UPDATE bookings
        SET status = $1
        WHERE id = $2
        RETURNING *;
      `;
      const { rows: updated } = await client.query(update, [action, booking_id]);
      if (!updated.length) throw new Error('Booking not found.');

      // 2ï¸âƒ£ Insert into approvals log
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

      // 3ï¸âƒ£ Trigger email notification
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
  console.error('Email notification failed:', emailErr);
}


      // 4ï¸âƒ£ Respond
      res.status(200).json({
        success: true,
        booking: updated[0],
        approval: approval[0],
      });
    } catch (txErr) {
      await client.query('ROLLBACK');
      console.error('Approval transaction error:', txErr);
      res.status(500).json({ error: 'Failed to record approval.' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Approval endpoint error:', err);
    res.status(500).json({ error: 'Unexpected server error.' });
  }
}

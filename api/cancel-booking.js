import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { token, reason } = req.body;

    if (!token || !reason) {
      return res.status(400).json({ error: 'Missing cancellation token or reason.' });
    }

    // ---- 1️⃣ find booking by token ----
    const { data: booking, error: lookupError } = await supabase
      .from('bookings')
      .select('id, status')
      .eq('cancel_token', token)
      .single();

    if (lookupError || !booking) {
      return res.status(404).json({ error: 'Invalid or expired cancellation link.' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ error: 'Booking already cancelled.' });
    }

    // ---- 2️⃣ record cancellation ----
    const { error: insertError } = await supabase
      .from('cancellations')
      .insert([{ booking_id: booking.id, reason }]);

    if (insertError) {
      console.error('Insert cancellation failed:', insertError);
      return res.status(500).json({ error: 'Failed to record cancellation.' });
    }

    // ---- 3️⃣ update booking status ----
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', booking.id);

    if (updateError) {
      console.error('Update booking status failed:', updateError);
      return res.status(500).json({ error: 'Failed to update booking status.' });
    }

    // ---- 4️⃣ done ----
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Cancellation error:', err);
    res.status(500).json({ error: 'Unexpected error', details: err.message });
  }
}

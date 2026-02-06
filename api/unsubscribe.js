import { createClient } from '@supabase/supabase-js';

// Initialize with the SERVICE ROLE key (bypasses RLS to allow updates)
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  // 1. Get the ID from the URL
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Missing ID' });
  }

  try {
    // 2. Update the subscriber status
    const { error } = await supabase
      .from('subscribers')
      .update({ status: 'unsubscribed' })
      .eq('id', id);

    if (error) throw error;

    // 3. Success
    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Unsubscribe Error:', err);
    return res.status(500).json({ error: 'Could not unsubscribe' });
  }
}
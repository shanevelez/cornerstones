import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';

function CancelBooking() {
  const { token } = useParams();
  const [booking, setBooking] = useState(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('form'); // 'form' | 'success' | 'error'
  const [error, setError] = useState('');

  // ---- Fetch booking by cancel token ----
  useEffect(() => {
    const fetchBooking = async () => {
      try {
        const { data, error } = await supabase
          .from('bookings')
          .select('*')
          .eq('cancel_token', token)
          .single();

        if (error || !data) {
          console.error('Lookup failed:', error);
          setError('Invalid or expired cancellation link.');
          setStatus('error');
        } else {
          setBooking(data);
        }
      } catch (err) {
        console.error(err);
        setError('Something went wrong.');
        setStatus('error');
      } finally {
        setLoading(false);
      }
    };
    fetchBooking();
  }, [token]);

  const handleCancel = async () => {
    if (!reason.trim()) {
      alert('Please enter a reason for cancelling.');
      return;
    }

    try {
      const res = await fetch('/api/cancel-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, reason }),
      });

      if (!res.ok) throw new Error('Cancellation failed');
      setStatus('success');
    } catch (err) {
      console.error(err);
      setStatus('error');
      setError('Failed to cancel your booking.');
    }
  };

  // ---- UI ----
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600">
        Loading booking details…
      </div>
    );
  }

  if (status === 'error') {
    return (
      <section className="min-h-screen flex items-center justify-center bg-neutralbg">
        <div className="bg-white shadow rounded-lg p-8 text-center border-t-4 border-red-600 max-w-md">
          <h2 className="text-2xl font-heading text-red-600 mb-3">Unable to Cancel</h2>
          <p className="text-gray-700">{error}</p>
        </div>
      </section>
    );
  }

  if (status === 'success') {
    return (
      <section className="min-h-screen flex items-center justify-center bg-neutralbg">
        <div className="bg-white shadow rounded-lg p-8 text-center border-t-4 border-primary max-w-md">
          <h2 className="text-2xl font-heading text-primary mb-3">Booking Cancelled</h2>
          <p className="text-gray-700 mb-4">
            Thank you, {booking?.guest_name}. Your booking for{' '}
            <strong>
              {new Date(booking.check_in).toLocaleDateString()} –{' '}
              {new Date(booking.check_out).toLocaleDateString()}
            </strong>{' '}
            has been successfully cancelled.
          </p>
          <p className="text-gray-600 text-sm">
            We hope to welcome you to Cornerstones another time.
          </p>
        </div>
      </section>
    );
  }

  // ---- Main cancellation form ----
  return (
    <section className="min-h-screen flex items-center justify-center bg-neutralbg p-6">
      <div className="bg-white shadow rounded-lg p-8 border-t-4 border-primary max-w-lg w-full">
        <h2 className="text-3xl font-heading text-primary mb-4 text-center">
          Cancel Booking
        </h2>

        <p className="text-gray-700 mb-6 text-center">
          Hi {booking.guest_name}, your stay from{' '}
          <strong>
            {new Date(booking.check_in).toLocaleDateString()} –{' '}
            {new Date(booking.check_out).toLocaleDateString()}
          </strong>{' '}
          is currently confirmed.
        </p>

        <label className="block font-semibold text-gray-700 mb-2">
          Please tell us why you’re cancelling:
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          className="w-full border border-gray-300 rounded-md p-3 mb-4 focus:ring-2 focus:ring-primary focus:outline-none"
          placeholder="Your reason for cancelling…"
        />

        <button
          onClick={handleCancel}
          className="w-full bg-red-600 text-white font-sans text-lg py-3 rounded-md shadow hover:bg-red-700 transition"
        >
          Confirm Cancellation
        </button>
      </div>
    </section>
  );
}

export default CancelBooking;

import { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';

function BookingsTable({ deepLinkId, setDeepLinkId, userRole }) {
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [currentUserId, setCurrentUserId] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // guard so deep link only fires once
  const hasOpenedFromDeepLink = useRef(false);

  // --- Fetch logged-in Supabase user
  useEffect(() => {
    const getUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) console.error('Failed to get user:', error);
      if (data?.user) setCurrentUserId(data.user.id);
    };
    getUser();
  }, []);

  // --- Fetch bookings based on filter
  useEffect(() => {
    const fetchBookings = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('status', filter)
        .order('created_at', { ascending: false });

      if (error) console.error('Error loading bookings:', error);
      else setBookings(data || []);
      setLoading(false);
    };
    fetchBookings();
  }, [filter]);

  // --- Deep-link open (fires once, self-destructs)
  useEffect(() => {
    if (!deepLinkId || hasOpenedFromDeepLink.current || bookings.length === 0) return;

    const match = bookings.find((b) => b.id === Number(deepLinkId));
    if (match) {
      setSelected(match);
      hasOpenedFromDeepLink.current = true;

      // clear parent state + URL immediately
      if (typeof setDeepLinkId === 'function') setDeepLinkId(null);
      const newUrl = new URL(window.location);
      newUrl.searchParams.delete('booking');
      window.history.replaceState({}, '', newUrl);
    }
  }, [deepLinkId, bookings, setDeepLinkId]);

  // --- Load cancellation reason if selected booking is cancelled
  useEffect(() => {
    const loadReason = async () => {
      if (selected?.status === 'cancelled') {
        const { data, error } = await supabase
          .from('cancellations')
          .select('reason')
          .eq('booking_id', selected.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        if (!error && data) setCancelReason(data.reason);
        else setCancelReason('No reason recorded.');
      } else setCancelReason('');
    };
    loadReason();
  }, [selected]);
console.log('APPROVAL PAYLOAD →', {
  booking_id: selected.id,
  user_id: currentUserId,
  action,
  comment,
});
console.log('APPROVAL PAYLOAD →', {
  booking_id: selected.id,
  user_id: currentUserId,
  action,
  comment,
});

  // --- Handle approve/reject action
  const handleApproval = async (action) => {
    setActionLoading(true);
    try {
      if (!currentUserId) {
        alert('Missing approver ID — please log in again.');
        setActionLoading(false);
        return;
      }
      const comment = document.getElementById('comment')?.value || '';

      const res = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: selected.id,
          user_id: currentUserId,
          action,
          comment,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        console.error('Approval failed:', err);
        alert(`Error: ${err.error || 'Failed to record approval.'}`);
        setActionLoading(false);
        return;
      }

      setSelected(null);
      // Refresh bookings after action
      const updated = await supabase
        .from('bookings')
        .select('*')
        .eq('status', filter)
        .order('created_at', { ascending: false });
      if (!updated.error) setBookings(updated.data);
    } catch (err) {
      console.error('Network error:', err);
      alert('Network error while submitting approval.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <section className="mt-8">
      <h3 className="text-2xl font-heading text-primary mb-4">Bookings</h3>

      {/* Filter controls */}
      <div className="mb-6">
        {/* Desktop buttons */}
        <div className="hidden sm:flex gap-3">
          {['pending', 'approved', 'rejected', 'cancelled'].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-md border ${
                filter === s
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Mobile dropdown */}
        <div className="sm:hidden">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full border rounded-md p-2 bg-white text-gray-700"
          >
            {['pending', 'approved', 'rejected', 'cancelled'].map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-gray-600">Loading bookings…</p>
      ) : bookings.length === 0 ? (
        <p className="text-gray-600">No {filter} bookings.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left border border-gray-200">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="px-4 py-2 border-b">Guest</th>
                <th className="px-4 py-2 border-b">Check-in</th>
                <th className="px-4 py-2 border-b">Check-out</th>
                <th className="px-4 py-2 border-b">Adults</th>
                <th className="px-4 py-2 border-b">Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr
                  key={b.id}
                  onClick={() => setSelected(b)}
                  className="hover:bg-yellow-50 cursor-pointer"
                >
                  <td className="px-4 py-2 border-b">{b.guest_name}</td>
                  <td className="px-4 py-2 border-b">
                    {new Date(b.check_in).toLocaleDateString('en-GB')}
                  </td>
                  <td className="px-4 py-2 border-b">
                    {new Date(b.check_out).toLocaleDateString('en-GB')}
                  </td>
                  <td className="px-4 py-2 border-b text-center">{b.adults}</td>
                  <td className="px-4 py-2 border-b capitalize">{b.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          {actionLoading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-xl overflow-hidden border border-gray-200">
            {/* Header */}
            <div className="flex justify-between items-center bg-primary text-white px-6 py-4">
              <h4 className="text-xl font-heading">Booking Details</h4>
              <button
                onClick={() => setSelected(null)}
                className="text-white text-2xl leading-none hover:text-yellow-200"
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-3 font-sans text-gray-800">
              <div className="flex flex-col sm:flex-row sm:justify-between">
                <p>
                  <span className="font-semibold">Guest:</span>{' '}
                  {selected.guest_name}
                </p>
                <p>
                  <span className="font-semibold">Email:</span>{' '}
                  <a
                    href={`mailto:${selected.guest_email}`}
                    className="text-blue-700 hover:text-blue-800 hover:underline transition"
                  >
                    {selected.guest_email}
                  </a>
                </p>
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-between">
                <p>
                  <span className="font-semibold">Check-in:</span>{' '}
                  {new Date(selected.check_in).toLocaleDateString('en-GB')}
                </p>
                <p>
                  <span className="font-semibold">Check-out:</span>{' '}
                  {new Date(selected.check_out).toLocaleDateString('en-GB')}
                </p>
              </div>

              <div className="border-t pt-3 mt-3">
                <p>
                  <span className="font-semibold">Adults:</span>{' '}
                  {selected.adults}
                </p>
                <p>
                  <span className="font-semibold">Grandchildren over 21:</span>{' '}
                  {selected.grandchildren_over21}
                </p>
                <p>
                  <span className="font-semibold">Children 16 +:</span>{' '}
                  {selected.children_16plus}
                </p>
                <p>
                  <span className="font-semibold">Students:</span>{' '}
                  {selected.students}
                </p>
                <p>
                  <span className="font-semibold">Family member:</span>{' '}
                  {selected.family_member ? 'Yes' : 'No'}
                </p>
              </div>

              <div className="border-t pt-3 mt-3 flex justify-between items-center">
                <p className="font-semibold">Status:</p>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${
                    selected.status === 'approved'
                      ? 'bg-green-100 text-green-700'
                      : selected.status === 'rejected'
                      ? 'bg-red-100 text-red-700'
                      : selected.status === 'cancelled'
                      ? 'bg-gray-200 text-gray-800'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {selected.status}
                </span>
              </div>

              {selected.status === 'cancelled' && (
                <div className="mt-4 border-t pt-3">
                  <p className="font-semibold text-red-700">
                    Cancellation Reason:
                  </p>
                  <p className="bg-gray-50 border rounded-md p-2">
                    {cancelReason}
                  </p>
                </div>
              )}

              {/* Approve/Reject */}
              {selected.status === 'pending' && (
                <div className="mt-6 space-y-3 border-t pt-4">
                  <label className="block font-semibold text-gray-700">
                    Comments (optional)
                  </label>
                  <textarea
                    id="comment"
                    placeholder="Add context for your decision…"
                    rows={3}
                    className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-primary focus:outline-none"
                  />

                  <div className="flex justify-end gap-3 pt-3">
                    <button
                      onClick={() => setSelected(null)}
                      className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
                    >
                      Cancel
                    </button>

                    {['Admin', 'Approver'].includes(userRole) && (
                      <>
                        <button
                          onClick={() => handleApproval('rejected')}
                          className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleApproval('approved')}
                          className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                        >
                          Approve
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {selected.status !== 'pending' && (
              <div className="bg-gray-50 px-6 py-4 flex justify-end">
                <button
                  onClick={() => setSelected(null)}
                  className="bg-primary text-white px-5 py-2 rounded-md shadow hover:bg-yellow-500 transition"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default BookingsTable;

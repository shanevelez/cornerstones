import { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import BookingCalendar from './BookingCalendar';

// --- HELPERS ---
const dateOnly = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const sameDay = (a, b) =>
  a && b && dateOnly(a).getTime() === dateOnly(b).getTime();

// Pure physics: Does Range A overlap Range B?
// (allowing them to touch at the very edges, e.g., one leaves morning, one arrives afternoon)
const overlapsExceptEdges = (r, b) => {
  const start = dateOnly(r.from);
  const end = dateOnly(r.to);
  const bStart = dateOnly(b.from);
  const bEnd = dateOnly(b.to);
  
  // Basic overlap check
  const overlaps = start < bEnd && end > bStart;
  
  if (!overlaps) return false;
  
  // If they just touch on the edges (Start == OtherEnd OR End == OtherStart), that is allowed
  if (sameDay(start, bEnd) || sameDay(end, bStart)) return false;
  
  return true;
};

function BookingsTable({ deepLinkId, setDeepLinkId, userRole }) {
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  
  // Selection & Actions
  const [selected, setSelected] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [currentUserId, setCurrentUserId] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Cancellation
  const [showCancel, setShowCancel] = useState(false);
  const [cancelInput, setCancelInput] = useState('');
  
  // Date Editing
  const [isEditingDates, setIsEditingDates] = useState(false);
  const [editRange, setEditRange] = useState({ from: undefined, to: undefined });
  const [blockedRanges, setBlockedRanges] = useState([]);
  const [dateError, setDateError] = useState(''); 

  // Deep linking
  const hasOpenedFromDeepLink = useRef(false);
  const [familyOverride, setFamilyOverride] = useState(null);

  useEffect(() => {
    const getUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) console.error('Failed to get user:', error);
      if (data?.user) setCurrentUserId(data.user.id);
    };
    getUser();
  }, []);

  useEffect(() => {
    const fetchBookings = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('status', filter)
        .order('check_in', { ascending: true });

      if (error) console.error('Error loading bookings:', error);
      else setBookings(data || []);
      setLoading(false);
    };
    fetchBookings();
  }, [filter]);

  useEffect(() => {
    if (!deepLinkId || hasOpenedFromDeepLink.current || bookings.length === 0) return;
    const match = bookings.find((b) => b.id === Number(deepLinkId));
    if (match) {
      handleSelectBooking(match);
      hasOpenedFromDeepLink.current = true;
      if (typeof setDeepLinkId === 'function') setDeepLinkId(null);
      const newUrl = new URL(window.location);
      newUrl.searchParams.delete('booking');
      window.history.replaceState({}, '', newUrl);
    }
  }, [deepLinkId, bookings, setDeepLinkId]);

  const handleSelectBooking = (booking) => {
    setSelected(booking);
    setFamilyOverride(booking.family_member);
    setShowCancel(false);
    setCancelInput('');
    setIsEditingDates(false);
    setDateError('');
    // Initialize edit range so calendar opens with correct dates selected
    setEditRange({
        from: new Date(booking.check_in),
        to: new Date(booking.check_out)
    });
  };

  // --- Load blocked dates for the calendar whenever a booking is selected
  useEffect(() => {
    if (!selected) return;

    const fetchBlockedDates = async () => {
        // Fetch all approved bookings to determine availability
        // CRITICAL: Exclude the CURRENT booking so it doesn't block itself
        const { data, error } = await supabase
            .from('bookings')
            .select('check_in, check_out')
            .eq('status', 'approved')
            .neq('id', selected.id); 

        if (!error && data) {
            const mapped = data.map(b => ({
                from: new Date(b.check_in),
                to: new Date(b.check_out)
            }));
            setBlockedRanges(mapped);
        }
    };
    fetchBlockedDates();
  }, [selected]);

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

  // --- Date Selection Logic (ADMIN VERSION - Simplified)
  const handleDateSelect = (next) => {
    // If user clears selection, just allow it temporarily
    if (!next || !next.from) {
        setEditRange({ from: undefined, to: undefined });
        setDateError('');
        return;
    }

    // If only start date is picked
    if (next.from && !next.to) {
        setEditRange({ from: next.from, to: undefined });
        setDateError('');
        return;
    }

    // If a full range is picked, check for collisions
    if (next.from && next.to) {
      const illegal = blockedRanges.some((b) => overlapsExceptEdges(next, b));
      if (illegal) {
        setDateError("Selected dates overlap with another booking.");
        // We still update the visual range so they can see what they clicked, 
        // but the error prevents saving.
        setEditRange(next); 
        return;
      }

      setDateError("");
      setEditRange(next);
    }
  };

  const handleDateUpdate = async () => {
      if (!editRange?.from || !editRange?.to) {
          alert("Please select a complete range.");
          return;
      }
      
      // Double check collision before saving
      const illegal = blockedRanges.some((b) => overlapsExceptEdges(editRange, b));
      if (illegal) {
          alert("Cannot save: Dates overlap with an existing booking.");
          return;
      }
      
      setActionLoading(true);
      const { error } = await supabase
        .from('bookings')
        .update({
            check_in: editRange.from,
            check_out: editRange.to
        })
        .eq('id', selected.id);

      setActionLoading(false);

      if (error) {
          alert("Failed to update dates.");
          console.error(error);
      } else {
          setSelected(prev => ({
              ...prev,
              check_in: editRange.from.toISOString(),
              check_out: editRange.to.toISOString()
          }));
          setIsEditingDates(false);
          
          const updated = await supabase
            .from('bookings')
            .select('*')
            .eq('status', filter)
            .order('check_in', { ascending: true });
          if (!updated.error) setBookings(updated.data);
      }
  };

  const handleApproval = async (action) => {
    setActionLoading(true);
    try {
      if (selected.status === 'pending' && familyOverride !== null && familyOverride !== selected.family_member) {
        const { error } = await supabase
          .from('bookings')
          .update({ family_member: familyOverride })
          .eq('id', selected.id);
        if (error) {
          alert('Failed to update family member flag.');
          setActionLoading(false);
          return;
        }
      }

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
      const updated = await supabase
        .from('bookings')
        .select('*')
        .eq('status', filter)
        .order('check_in', { ascending: true });
      if (!updated.error) setBookings(updated.data);
    } catch (err) {
      console.error('Network error:', err);
      alert('Network error while submitting approval.');
    } finally {
      setActionLoading(false);
    }
  };

  const confirmCancel = async () => {
    if (!selected || !cancelInput.trim()) return;
    setActionLoading(true);
    try {
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', selected.id);

      if (bookingError) {
        console.error('Error cancelling booking:', bookingError);
        alert('Failed to cancel booking.');
        return;
      }

      const { error: cancelError } = await supabase
        .from('cancellations')
        .insert({
          booking_id: selected.id,
          reason: cancelInput.trim(),
        });

      if (cancelError) {
        console.error('Error writing cancellation reason:', cancelError);
        alert('Cancelled booking, but failed to record reason.');
      }

      setSelected((prev) => (prev ? { ...prev, status: 'cancelled' } : prev));
      setCancelReason(cancelInput.trim());
      setShowCancel(false);
      setCancelInput('');

      const refreshed = await supabase
        .from('bookings')
        .select('*')
        .eq('status', filter)
        .order('check_in', { ascending: true });

      if (!refreshed.error) setBookings(refreshed.data);
    } catch (err) {
      console.error('Network error while cancelling:', err);
      alert('Network error while cancelling booking.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <section className="mt-8">
      <h3 className="text-2xl font-heading text-primary mb-4">Bookings</h3>

      <div className="mb-6">
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
                  onClick={() => handleSelectBooking(b)}
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

      {selected && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          {actionLoading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-xl overflow-y-auto max-h-[90vh] border border-gray-200">
            <div className="flex justify-between items-center bg-primary text-white px-6 py-4">
              <h4 className="text-xl font-heading">Booking Details</h4>
              <button
                onClick={() => setSelected(null)}
                className="text-white text-2xl leading-none hover:text-yellow-200"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-3 font-sans text-gray-800">
              <div className="flex flex-col sm:flex-row sm:justify-between">
                <p>
                  <span className="font-semibold">Guest:</span> {selected.guest_name}
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

              {/* --- DATE SECTION --- */}
              <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                {!isEditingDates ? (
                    <div className="flex justify-between items-center">
                        <div className="space-y-1">
                            {/* Make dates clickable for Edit Mode */}
                            <div className="flex gap-2">
                                <span className="font-semibold w-24">Check-in:</span> 
                                {['Admin', 'Approver'].includes(userRole) && selected.status !== 'cancelled' ? (
                                    <button onClick={() => setIsEditingDates(true)} className="text-blue-700 hover:underline hover:bg-blue-50 rounded px-1 -ml-1">
                                        {new Date(selected.check_in).toLocaleDateString('en-GB')} ✎
                                    </button>
                                ) : (
                                    <span>{new Date(selected.check_in).toLocaleDateString('en-GB')}</span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <span className="font-semibold w-24">Check-out:</span> 
                                {['Admin', 'Approver'].includes(userRole) && selected.status !== 'cancelled' ? (
                                    <button onClick={() => setIsEditingDates(true)} className="text-blue-700 hover:underline hover:bg-blue-50 rounded px-1 -ml-1">
                                        {new Date(selected.check_out).toLocaleDateString('en-GB')} ✎
                                    </button>
                                ) : (
                                    <span>{new Date(selected.check_out).toLocaleDateString('en-GB')}</span>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center">
                        <h5 className="font-bold text-gray-700 mb-2">Select Available Dates</h5>
                        
                        <div className="scale-90 origin-top">
                            <BookingCalendar 
                                bookings={blockedRanges}
                                range={editRange}
                                onChange={handleDateSelect}
                            />
                        </div>

                        {dateError && (
                            <p className="text-red-600 text-sm font-semibold mt-2">{dateError}</p>
                        )}

                        <div className="flex gap-2 mt-2 w-full justify-end">
                            <button 
                                onClick={() => {
                                    setIsEditingDates(false);
                                    setEditRange({ from: new Date(selected.check_in), to: new Date(selected.check_out) });
                                }}
                                className="px-3 py-1 text-sm bg-gray-300 rounded hover:bg-gray-400"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleDateUpdate}
                                disabled={!!dateError || !editRange.to || !editRange.from}
                                className={`px-3 py-1 text-sm rounded text-white ${!!dateError || !editRange.to || !editRange.from ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                            >
                                Save Dates
                            </button>
                        </div>
                    </div>
                )}
              </div>
              {/* --- END DATE SECTION --- */}

              <div className="border-t pt-3 mt-3">
                <p>
                  <span className="font-semibold">Adults:</span> {selected.adults}
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
                  <span className="font-semibold">Students:</span> {selected.students}
                </p>
                {selected.status === 'pending' && ['Admin', 'Approver'].includes(userRole) ? (
                  <label className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      checked={!!familyOverride}
                      onChange={(e) => setFamilyOverride(e.target.checked)}
                    />
                    Family member
                  </label>
                ) : (
                  <p>
                    <span className="font-semibold">Family member:</span>{' '}
                    {selected.family_member ? 'Yes' : 'No'}
                  </p>
                )}
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
                  <p className="font-semibold text-red-700">Cancellation Reason:</p>
                  <p className="bg-gray-50 border rounded-md p-2">{cancelReason}</p>
                </div>
              )}

              {selected.status === 'approved' && ['Admin', 'Approver'].includes(userRole) && !isEditingDates && (
                <div className="mt-6 space-y-3 border-t pt-4">
                  {!showCancel ? (
                    <div className="flex justify-end">
                      <button
                        onClick={() => setShowCancel(true)}
                        className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
                      >
                        Cancel booking
                      </button>
                    </div>
                  ) : (
                    <>
                      <label className="block font-semibold text-gray-700">
                        Cancellation reason
                      </label>
                      <textarea
                        value={cancelInput}
                        onChange={(e) => setCancelInput(e.target.value)}
                        placeholder="Explain why this booking is being cancelled…"
                        rows={3}
                        className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-primary focus:outline-none"
                      />
                      <div className="flex justify-end gap-3 pt-1">
                        <button
                          onClick={() => {
                            setShowCancel(false);
                            setCancelInput('');
                          }}
                          className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
                        >
                          Back
                        </button>
                        <button
                          onClick={confirmCancel}
                          disabled={!cancelInput.trim()}
                          className={`px-4 py-2 rounded-md text-white ${
                            cancelInput.trim()
                              ? 'bg-red-600 hover:bg-red-700'
                              : 'bg-red-300 cursor-not-allowed'
                          }`}
                        >
                          Confirm cancellation
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {selected.status === 'pending' && !isEditingDates && (
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

            {selected.status !== 'pending' && !isEditingDates && (
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
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import BookingCalendar from './BookingCalendar';

// --- HELPERS ---
const dateOnly = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const sameDay = (a, b) =>
  a && b && dateOnly(a).getTime() === dateOnly(b).getTime();

// Physics check: Does Range A overlap Range B?
const overlapsExceptEdges = (r, b) => {
  const start = dateOnly(r.from);
  const end = dateOnly(r.to);
  const bStart = dateOnly(b.from);
  const bEnd = dateOnly(b.to);
  
  const overlaps = start < bEnd && end > bStart;
  if (!overlaps) return false;
  // Allow touching edges (leaving same day someone arrives)
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
  
  // --- SINGLE DATE EDIT STATE ---
  const [editMode, setEditMode] = useState(null); // 'check_in' or 'check_out'
  const [editRange, setEditRange] = useState({ from: undefined, to: undefined });
  const [blockedRanges, setBlockedRanges] = useState([]);
  const [dateError, setDateError] = useState(''); 

  const hasOpenedFromDeepLink = useRef(false);
  const [familyOverride, setFamilyOverride] = useState(null);

  // Fetch User
  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) setCurrentUserId(data.user.id);
    };
    getUser();
  }, []);

  // Fetch Bookings
  useEffect(() => {
    const fetchBookings = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('status', filter)
        .order('check_in', { ascending: true });

      if (error) console.error(error);
      else setBookings(data || []);
      setLoading(false);
    };
    fetchBookings();
  }, [filter]);

  // Deep Link
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
    setEditMode(null);
    setDateError('');
    // Initialize edit range
    setEditRange({
        from: new Date(booking.check_in),
        to: new Date(booking.check_out)
    });
  };

  // Load blocked dates (excluding current booking)
  useEffect(() => {
    if (!selected) return;
    const fetchBlockedDates = async () => {
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

  // Load cancellation reason
  useEffect(() => {
    const loadReason = async () => {
      if (selected?.status === 'cancelled') {
        const { data } = await supabase
          .from('cancellations')
          .select('reason')
          .eq('booking_id', selected.id)
          .single();
        if (data) setCancelReason(data.reason);
        else setCancelReason('No reason recorded.');
      } else setCancelReason('');
    };
    loadReason();
  }, [selected]);

  // --- LOGIC: Handle Single Date Click ---
  const startEditing = (mode) => {
      setEditMode(mode);
      setDateError('');
      // Reset range to DB values to ensure accuracy
      setEditRange({
          from: new Date(selected.check_in),
          to: new Date(selected.check_out)
      });
  };

  const handleSingleDateSelect = (calendarSelection) => {
      // User clicked a date. 'calendarSelection' might be a range or partial range.
      // We only care about the 'from' date (the date they just clicked).
      const clickDate = calendarSelection?.from;
      if (!clickDate) return; 

      let proposedRange = { from: undefined, to: undefined };

      if (editMode === 'check_in') {
          // Change Check-in, KEEP Check-out
          proposedRange = {
              from: clickDate,
              to: new Date(selected.check_out)
          };
      } else if (editMode === 'check_out') {
          // KEEP Check-in, Change Check-out
          proposedRange = {
              from: new Date(selected.check_in),
              to: clickDate
          };
      }

      // 1. Validate: Start < End
      if (proposedRange.from >= proposedRange.to) {
          // Still update the view so they see the date they clicked
          setEditRange(proposedRange); 
          setDateError(editMode === 'check_in' 
              ? "Check-in must be before Check-out." 
              : "Check-out must be after Check-in.");
          return;
      }

      // 2. Validate: Overlaps
      const illegal = blockedRanges.some((b) => overlapsExceptEdges(proposedRange, b));
      if (illegal) {
          setEditRange(proposedRange);
          setDateError("Overlap detected. Please choose another date.");
          return;
      }

      // 3. Success
      setDateError('');
      setEditRange(proposedRange);
  };

  const saveDateChange = async () => {
      if (dateError || !editRange.from || !editRange.to) return;

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
      } else {
          // Local update
          setSelected(prev => ({
              ...prev,
              check_in: editRange.from.toISOString(),
              check_out: editRange.to.toISOString()
          }));
          setEditMode(null);
          // Refresh list
          const updated = await supabase
            .from('bookings')
            .select('*')
            .eq('status', filter)
            .order('check_in', { ascending: true });
          if (!updated.error) setBookings(updated.data);
      }
  };


  // --- Approval/Rejection Logic ---
  const handleApproval = async (action) => {
    setActionLoading(true);
    try {
      if (selected.status === 'pending' && familyOverride !== null && familyOverride !== selected.family_member) {
        await supabase.from('bookings').update({ family_member: familyOverride }).eq('id', selected.id);
      }
      if (!currentUserId) {
        alert('Missing approver ID.');
        setActionLoading(false);
        return;
      }
      const comment = document.getElementById('comment')?.value || '';
      const res = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: selected.id, user_id: currentUserId, action, comment }),
      });
      if (!res.ok) throw new Error();
      
      setSelected(null);
      const updated = await supabase.from('bookings').select('*').eq('status', filter).order('check_in', { ascending: true });
      if (!updated.error) setBookings(updated.data);
    } catch (err) {
      alert('Error recording approval.');
    } finally {
      setActionLoading(false);
    }
  };

  const confirmCancel = async () => {
    if (!selected || !cancelInput.trim()) return;
    setActionLoading(true);
    try {
      await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', selected.id);
      await supabase.from('cancellations').insert({ booking_id: selected.id, reason: cancelInput.trim() });
      setSelected((prev) => (prev ? { ...prev, status: 'cancelled' } : prev));
      setCancelReason(cancelInput.trim());
      setShowCancel(false);
      setCancelInput('');
      const refreshed = await supabase.from('bookings').select('*').eq('status', filter).order('check_in', { ascending: true });
      if (!refreshed.error) setBookings(refreshed.data);
    } catch (err) {
      alert('Error cancelling.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <section className="mt-8">
      <h3 className="text-2xl font-heading text-primary mb-4">Bookings</h3>
      {/* Filters */}
      <div className="mb-6 flex gap-3">
        {['pending', 'approved', 'rejected', 'cancelled'].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`px-4 py-2 rounded-md border ${filter === s ? 'bg-primary text-white' : 'bg-white text-gray-700'}`}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? <p>Loading...</p> : bookings.length === 0 ? <p>No {filter} bookings.</p> : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left border border-gray-200">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="px-4 py-2">Guest</th>
                <th className="px-4 py-2">Check-in</th>
                <th className="px-4 py-2">Check-out</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} onClick={() => handleSelectBooking(b)} className="hover:bg-yellow-50 cursor-pointer border-b">
                  <td className="px-4 py-2">{b.guest_name}</td>
                  <td className="px-4 py-2">{new Date(b.check_in).toLocaleDateString('en-GB')}</td>
                  <td className="px-4 py-2">{new Date(b.check_out).toLocaleDateString('en-GB')}</td>
                  <td className="px-4 py-2 capitalize">{b.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-xl overflow-y-auto max-h-[90vh] border border-gray-200 relative">
             {/* Spinner overlay */}
            {actionLoading && <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-50"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>}
            
            <div className="flex justify-between items-center bg-primary text-white px-6 py-4">
              <h4 className="text-xl font-heading">Booking Details</h4>
              <button onClick={() => setSelected(null)} className="text-white text-2xl">×</button>
            </div>

            <div className="p-6 space-y-4 text-gray-800">
              <div className="flex justify-between font-semibold">
                <span>{selected.guest_name}</span>
                <span className="text-gray-500 font-normal">{selected.guest_email}</span>
              </div>

              {/* DATE EDIT SECTION */}
              <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                {!editMode ? (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <div className="flex gap-2">
                           <span className="font-semibold w-24">Check-in:</span>
                           <span>{new Date(selected.check_in).toLocaleDateString('en-GB')}</span>
                        </div>
                        {['Admin', 'Approver'].includes(userRole) && selected.status !== 'cancelled' && (
                            <button onClick={() => startEditing('check_in')} className="text-sm text-blue-600 hover:underline">Edit</button>
                        )}
                    </div>
                    <div className="flex justify-between items-center">
                        <div className="flex gap-2">
                            <span className="font-semibold w-24">Check-out:</span>
                            <span>{new Date(selected.check_out).toLocaleDateString('en-GB')}</span>
                        </div>
                        {['Admin', 'Approver'].includes(userRole) && selected.status !== 'cancelled' && (
                            <button onClick={() => startEditing('check_out')} className="text-sm text-blue-600 hover:underline">Edit</button>
                        )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <h5 className="font-bold text-gray-700 mb-2">
                        {editMode === 'check_in' ? 'Change Check-in Date' : 'Change Check-out Date'}
                    </h5>
                    
                    {/* CRITICAL: We pass defaultMonth so it opens to the booking month.
                       We pass mode="range" but handleSingleDateSelect makes it act like a single click.
                    */}
                    <div className="scale-90 origin-top">
                        <BookingCalendar 
                            bookings={blockedRanges}
                            range={editRange} 
                            onChange={handleSingleDateSelect}
                            defaultMonth={new Date(selected.check_in)} 
                        />
                    </div>

                    {dateError && (
                        <p className="text-red-600 text-sm font-semibold mt-2 text-center">{dateError}</p>
                    )}

                    <div className="flex gap-3 mt-4 w-full justify-center">
                        <button onClick={() => setEditMode(null)} className="px-4 py-2 text-sm bg-gray-300 rounded hover:bg-gray-400">
                            Cancel
                        </button>
                        <button onClick={saveDateChange} disabled={!!dateError} className={`px-4 py-2 text-sm rounded text-white ${!!dateError ? 'bg-blue-300' : 'bg-blue-600 hover:bg-blue-700'}`}>
                            Save
                        </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Standard Footer Actions */}
              {!editMode && selected.status === 'pending' && (
                <div className="border-t pt-4">
                  <textarea id="comment" placeholder="Comments..." className="w-full border p-2 rounded mb-3" />
                  <div className="flex justify-end gap-2">
                     <button onClick={() => handleApproval('rejected')} className="bg-red-600 text-white px-3 py-1 rounded">Reject</button>
                     <button onClick={() => handleApproval('approved')} className="bg-green-600 text-white px-3 py-1 rounded">Approve</button>
                  </div>
                </div>
              )}
               
              {!editMode && selected.status === 'approved' && ['Admin', 'Approver'].includes(userRole) && (
                 <div className="border-t pt-4 flex justify-end">
                     <button onClick={() => setShowCancel(true)} className="text-red-600 hover:underline text-sm">Cancel Booking</button>
                 </div>
              )}
              
              {showCancel && (
                  <div className="bg-red-50 p-4 rounded mt-2">
                      <textarea value={cancelInput} onChange={(e) => setCancelInput(e.target.value)} placeholder="Reason..." className="w-full border p-2 rounded mb-2" />
                      <button onClick={confirmCancel} className="bg-red-600 text-white px-3 py-1 rounded w-full">Confirm Cancellation</button>
                  </div>
              )}

            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default BookingsTable;
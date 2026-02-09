import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

function BookingPaymentsTable({ userRole }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortDir, setSortDir] = useState('asc');
  const [updatingId, setUpdatingId] = useState(null);
  const [paidFilter, setPaidFilter] = useState('unpaid');
  
  // NEW: State for the modal
  const [selectedBooking, setSelectedBooking] = useState(null);

  const canEdit = ['Admin', 'Payment Manager'].includes(userRole);

  // 💷 Pricing Logic Helper (KEPT EXACTLY AS IS FOR TABLE)
  const calculateAmountDue = (booking) => {
    if (!booking) return 0;

    const {
      check_in,
      check_out,
      adults = 0,
      grandchildren_over21 = 0,
      children_16plus = 0,
      students = 0,
      family_member,
    } = booking;

    // 1. Calculate Nights
    const start = new Date(check_in);
    const end = new Date(check_out);
    const diffTime = Math.abs(end - start);
    const nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    
    // Safety check for weird dates
    if (nights <= 0) return 0;

    let nightlyTotal = 0;

    // 2. Apply Rates based on Family Status
    if (family_member) {
      // Family Rates
      nightlyTotal += (adults * 32);
      nightlyTotal += (grandchildren_over21 * 25);
      nightlyTotal += ((children_16plus + students) * 12);
    } else {
      // Regular Rates
      // Note: "Grandchildren over 21" are technically adults (21+) so they get the £40 rate if not family
      nightlyTotal += ((adults + grandchildren_over21) * 40);
      nightlyTotal += ((children_16plus + students) * 12);
    }

    // 3. Final Sum (Nights + £40 Cleaning fee)
    return (nightlyTotal * nights) + 40;
  };

  // NEW: Helper specifically for generating the modal line items
  const getBreakdownData = (booking) => {
    if (!booking) return null;
    const { check_in, check_out, adults=0, grandchildren_over21=0, children_16plus=0, students=0, family_member } = booking;
    
    const start = new Date(check_in);
    const end = new Date(check_out);
    const diffTime = Math.abs(end - start);
    const nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    if (nights <= 0) return null;

    const lines = [];

    if (family_member) {
       if (adults > 0) lines.push({ label: 'Adults (Family)', count: adults, rate: 32, total: adults * 32 * nights });
       if (grandchildren_over21 > 0) lines.push({ label: 'Grandchildren 21+ (Family)', count: grandchildren_over21, rate: 25, total: grandchildren_over21 * 25 * nights });
       const young = children_16plus + students;
       if (young > 0) lines.push({ label: 'Children 16+ / Students (Family)', count: young, rate: 12, total: young * 12 * nights });
    } else {
       const bigAdults = adults + grandchildren_over21;
       if (bigAdults > 0) lines.push({ label: 'Adults & GC 21+', count: bigAdults, rate: 40, total: bigAdults * 40 * nights });
       const young = children_16plus + students;
       if (young > 0) lines.push({ label: 'Children 16+ / Students', count: young, rate: 12, total: young * 12 * nights });
    }

    const subTotal = lines.reduce((acc, curr) => acc + curr.total, 0);
    return { lines, nights, subTotal, total: subTotal + 40 };
  };

  const fetchPayments = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('booking_payments')
      .select(`
        booking_id,
        booking_ref,
        is_paid,
        bookings!inner (
          guest_name,
          check_in,
          check_out,
          status,
          adults,
          grandchildren_over21,
          children_16plus,
          students,
          family_member
        )
      `)
      .eq('is_paid', paidFilter === 'paid')
      .in('bookings.status', ['pending', 'approved', 'Pending', 'Approved']); // Use !inner logic

    if (error) {
      console.error('booking_payments error:', error);
      setRows([]);
    } else {
      const sorted = [...(data || [])].sort((a, b) => {
        const aDate = new Date(a.bookings.check_in);
        const bDate = new Date(b.bookings.check_in);
        return sortDir === 'asc'
          ? aDate - bDate
          : bDate - aDate;
      });

      setRows(sorted);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchPayments();
  }, [sortDir, paidFilter]);

  const togglePaid = async (row) => {
    if (!canEdit) return;

    setUpdatingId(row.booking_id);

    const { error } = await supabase
      .from('booking_payments')
      .update({
        is_paid: !row.is_paid,
        updated_at: new Date().toISOString(),
      })
      .eq('booking_id', row.booking_id);

    if (error) {
      console.error('Failed to update payment status', error);
      alert('Failed to update payment status.');
    } else {
      fetchPayments();
    }

    setUpdatingId(null);
  };

  if (loading) {
    return <p className="text-gray-600">Loading payment status…</p>;
  }

  // Calculate modal data if a booking is selected
  const breakdownData = selectedBooking ? getBreakdownData(selectedBooking.bookings) : null;

  return (
    <>
      {/* NEW: COST BREAKDOWN MODAL */}
      {selectedBooking && breakdownData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedBooking(null)}>
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative" onClick={(e) => e.stopPropagation()}>
                <button 
                    onClick={() => setSelectedBooking(null)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 font-bold text-xl"
                >
                    &times;
                </button>
                
                <h3 className="text-lg font-bold mb-1">Cost Breakdown</h3>
                <p className="text-sm text-gray-500 mb-4">Ref: {selectedBooking.booking_ref} • {breakdownData.nights} Nights</p>

                <div className="space-y-2 text-sm">
                    {breakdownData.lines.map((line, idx) => (
                        <div key={idx} className="flex justify-between border-b border-gray-100 pb-1">
                            <span>{line.label} <span className="text-gray-400 text-xs">({line.count} × £{line.rate})</span></span>
                            <span className="font-mono">£{line.total}</span>
                        </div>
                    ))}
                    
                    <div className="flex justify-between border-b border-gray-100 pb-1 pt-2">
                        <span>Cleaning Fee</span>
                        <span className="font-mono">£40</span>
                    </div>

                    <div className="flex justify-between pt-3 font-bold text-lg">
                        <span>Total</span>
                        <span>£{breakdownData.total}</span>
                    </div>
                </div>

                <div className="mt-6 flex justify-end">
                    <button 
                        onClick={() => setSelectedBooking(null)}
                        className="bg-gray-100 text-gray-700 px-4 py-2 rounded hover:bg-gray-200"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
      )}

      <div className="mb-6">
        <div className="hidden sm:flex gap-3">
          {['unpaid', 'paid'].map((s) => (
            <button
              key={s}
              onClick={() => setPaidFilter(s)}
              className={`px-4 py-2 rounded-md border ${
                paidFilter === s
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Mobile dropdown - KEPT */}
        <div className="sm:hidden">
          <select
            value={paidFilter}
            onChange={(e) => setPaidFilter(e.target.value)}
            className="w-full border rounded-md p-2 bg-white text-gray-700"
          >
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left border border-gray-200">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="px-4 py-2 border-b">Booking Ref</th>
              <th className="px-4 py-2 border-b">Guest</th>
              <th
                className="px-4 py-2 border-b cursor-pointer select-none"
                onClick={() =>
                  setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
                }
              >
                Check-in {sortDir === 'asc' ? '↑' : '↓'}
              </th>
              <th className="px-4 py-2 border-b">Check-out</th>
              <th className="px-4 py-2 border-b text-right">Amount</th> {/* NEW COLUMN */}
              <th className="px-4 py-2 border-b text-center">Paid</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr 
                key={r.booking_id} 
                className="hover:bg-yellow-50 cursor-pointer" // Added cursor-pointer
                onClick={() => setSelectedBooking(r)} // Added Click Handler
            >
                <td className="px-4 py-2 border-b font-mono">
                  {r.booking_ref}
                </td>
                <td className="px-4 py-2 border-b">
                  {r.bookings?.guest_name}
                  {r.bookings?.family_member && (
                    <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                      Family
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 border-b">
                  {new Date(r.bookings.check_in).toLocaleDateString('en-GB')}
                </td>
                <td className="px-4 py-2 border-b">
                  {new Date(r.bookings.check_out).toLocaleDateString('en-GB')}
                </td>
                
                {/* NEW AMOUNT CELL */}
                <td className="px-4 py-2 border-b text-right font-medium">
                  £{calculateAmountDue(r.bookings).toLocaleString()}
                </td>

                <td className="px-4 py-2 border-b text-center">
                  {canEdit ? (
                    <button
                      disabled={updatingId === r.booking_id}
                      onClick={(e) => {
                          e.stopPropagation(); // Added Stop Propagation
                          togglePaid(r);
                      }}
                      className={`px-3 py-1 rounded-md text-sm font-medium ${
                        r.is_paid
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-red-100 text-red-700 hover:bg-red-200'
                      }`}
                    >
                      {r.is_paid ? 'Paid' : 'Unpaid'}
                    </button>
                  ) : (
                    <span
                      className={`px-3 py-1 rounded-md text-sm font-medium ${
                        r.is_paid
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {r.is_paid ? 'Paid' : 'Unpaid'}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default BookingPaymentsTable;
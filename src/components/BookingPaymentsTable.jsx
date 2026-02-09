import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

function BookingPaymentsTable({ userRole }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortDir, setSortDir] = useState('asc');
  const [updatingId, setUpdatingId] = useState(null);
  const [paidFilter, setPaidFilter] = useState('unpaid');
  
  // Modal State
  const [selectedBooking, setSelectedBooking] = useState(null);

  const canEdit = ['Admin', 'Payment Manager'].includes(userRole);

  // 💷 Pricing Logic Helper (Table View - Returns Total Only)
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

    const start = new Date(check_in);
    const end = new Date(check_out);
    const diffTime = Math.abs(end - start);
    const nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    
    if (nights <= 0) return 0;

    let nightlyTotal = 0;

    if (family_member) {
      nightlyTotal += (adults * 32);
      nightlyTotal += (grandchildren_over21 * 25);
      nightlyTotal += ((children_16plus + students) * 12);
    } else {
      nightlyTotal += ((adults + grandchildren_over21) * 40);
      nightlyTotal += ((children_16plus + students) * 12);
    }

    return (nightlyTotal * nights) + 40;
  };

  // 💷 Modal Breakdown Helper (Itemized List)
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
       // --- FAMILY RATES ---
       if (adults > 0) lines.push({ label: 'Adults (Family)', count: adults, rate: 32, total: adults * 32 * nights });
       if (grandchildren_over21 > 0) lines.push({ label: 'Grandchildren 21+ (Family)', count: grandchildren_over21, rate: 25, total: grandchildren_over21 * 25 * nights });
       
       const young = children_16plus + students;
       if (young > 0) lines.push({ label: 'Children 16+ / Students (Family)', count: young, rate: 12, total: young * 12 * nights });
    } else {
       // --- STANDARD RATES ---
       // SEPARATED: Adults
       if (adults > 0) lines.push({ label: 'Adults', count: adults, rate: 40, total: adults * 40 * nights });
       
       // SEPARATED: Grandchildren 21+
       if (grandchildren_over21 > 0) lines.push({ label: 'Grandchildren 21+', count: grandchildren_over21, rate: 40, total: grandchildren_over21 * 40 * nights });

       // Combined Young Adults (Since they are same category/price)
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
      .in('bookings.status', ['pending', 'approved', 'Pending', 'Approved']);

    if (error) {
      console.error('booking_payments error:', error);
      setRows([]);
    } else {
      const sorted = [...(data || [])].sort((a, b) => {
        const aDate = new Date(a.bookings.check_in);
        const bDate = new Date(b.bookings.check_in);
        return sortDir === 'asc' ? aDate - bDate : bDate - aDate;
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
      .update({ is_paid: !row.is_paid, updated_at: new Date().toISOString() })
      .eq('booking_id', row.booking_id);

    if (error) {
      console.error('Failed to update payment status', error);
      alert('Failed to update payment status.');
    } else {
      fetchPayments();
    }
    setUpdatingId(null);
  };

  if (loading) return <p className="text-gray-600">Loading payment status…</p>;

  // Prepare Modal Data
  const breakdownData = selectedBooking ? getBreakdownData(selectedBooking.bookings) : null;

  return (
    <>
      {/* --- MODAL --- */}
      {selectedBooking && breakdownData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedBooking(null)}>
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-xl overflow-y-auto max-h-[90vh] border border-gray-200 relative" onClick={(e) => e.stopPropagation()}>
            
            {/* Header */}
            <div className="flex justify-between items-center bg-primary text-white px-6 py-4">
              <h4 className="text-xl font-heading">Cost Breakdown</h4>
              <button onClick={() => setSelectedBooking(null)} className="text-white text-2xl">×</button>
            </div>

            <div className="p-6 space-y-4 text-gray-800">
              
              {/* Guest Info Header */}
              <div className="flex justify-between font-semibold text-lg">
                 <span>{selectedBooking.bookings.guest_name}</span>
                 <span className="text-gray-500 font-normal font-mono text-base">{selectedBooking.booking_ref}</span>
              </div>

              {/* Date Box */}
              <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                 <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="font-semibold w-24">Check-in:</span>
                        <span>{new Date(selectedBooking.bookings.check_in).toLocaleDateString('en-GB')}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="font-semibold w-24">Check-out:</span>
                        <span>{new Date(selectedBooking.bookings.check_out).toLocaleDateString('en-GB')}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-gray-200 mt-2">
                        <span className="text-sm text-gray-500">Duration</span>
                        <span className="text-sm font-medium">{breakdownData.nights} Nights</span>
                    </div>
                 </div>
              </div>

              {/* Cost Lines */}
              <div className="border-t pt-3 mt-3 space-y-2">
                <h5 className="font-semibold text-gray-700 mb-2">Itemized Costs</h5>
                
                {breakdownData.lines.map((line, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                        <span>
                          {line.label} 
                          <span className="text-gray-400 ml-1">({line.count} × £{line.rate} × {breakdownData.nights}n)</span>
                        </span>
                        <span className="font-mono text-gray-700">£{line.total}</span>
                    </div>
                ))}
                
                <div className="flex justify-between text-sm">
                    <span>Cleaning Fee</span>
                    <span className="font-mono text-gray-700">£40</span>
                </div>
              </div>

              {/* Total Footer */}
              <div className="border-t pt-3 mt-3 flex justify-between items-center bg-yellow-50 p-3 rounded-md">
                <span className="font-bold text-lg text-primary">Total Due</span>
                <span className="font-bold text-xl">£{breakdownData.total}</span>
              </div>
              
              {/* Close Button */}
              <div className="flex justify-end pt-2">
                 <button 
                    onClick={() => setSelectedBooking(null)}
                    className="bg-gray-100 text-gray-700 px-4 py-2 rounded hover:bg-gray-200"
                 >
                    Close
                 </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* --- FILTERS --- */}
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

        {/* Mobile dropdown */}
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
                onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
              >
                Check-in {sortDir === 'asc' ? '↑' : '↓'}
              </th>
              <th className="px-4 py-2 border-b">Check-out</th>
              <th className="px-4 py-2 border-b text-right">Amount</th>
              <th className="px-4 py-2 border-b text-center">Paid</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr 
                key={r.booking_id} 
                className="hover:bg-yellow-50 cursor-pointer border-b"
                onClick={() => setSelectedBooking(r)}
              >
                <td className="px-4 py-2 font-mono">{r.booking_ref}</td>
                <td className="px-4 py-2">
                  {r.bookings?.guest_name}
                  {r.bookings?.family_member && (
                    <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                      Family
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">{new Date(r.bookings.check_in).toLocaleDateString('en-GB')}</td>
                <td className="px-4 py-2">{new Date(r.bookings.check_out).toLocaleDateString('en-GB')}</td>
                <td className="px-4 py-2 text-right font-medium">
                  £{calculateAmountDue(r.bookings).toLocaleString()}
                </td>
                <td className="px-4 py-2 text-center">
                  {canEdit ? (
                    <button
                      disabled={updatingId === r.booking_id}
                      onClick={(e) => {
                          e.stopPropagation();
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
                    <span className={`px-3 py-1 rounded-md text-sm font-medium ${
                        r.is_paid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
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
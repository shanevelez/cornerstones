import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

function BookingPaymentsTable({ userRole }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortDir, setSortDir] = useState('asc');
  const [updatingId, setUpdatingId] = useState(null);
const [paidFilter, setPaidFilter] = useState('unpaid');

  const canEdit = ['Admin', 'Payment Manager'].includes(userRole);

  const fetchPayments = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('booking_payments')
.select(`
  booking_id,
  booking_ref,
  is_paid,
  bookings (
    guest_name,
    check_in,
    check_out
  )
`)
.eq('is_paid', paidFilter === 'paid')
.order('check_in', {
  referencedTable: 'bookings',
  ascending: sortDir === 'asc',
});


    if (error) {
      console.error('booking_payments error:', error);
      setRows([]);
    } else {
      setRows(data || []);
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
      setRows((prev) =>
        prev.map((r) =>
          r.booking_id === row.booking_id
            ? { ...r, is_paid: !r.is_paid }
            : r
        )
      );
    }

    setUpdatingId(null);
  };

  if (loading) {
    return <p className="text-gray-600">Loading payment status…</p>;
  }

  

  return (
  <>
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
              onClick={() =>
                setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
              }
            >
              Check-in {sortDir === 'asc' ? '↑' : '↓'}
            </th>
            <th className="px-4 py-2 border-b">Check-out</th>
            <th className="px-4 py-2 border-b text-center">Paid</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.booking_id} className="hover:bg-yellow-50">
              <td className="px-4 py-2 border-b font-mono">
                {r.booking_ref}
              </td>
              <td className="px-4 py-2 border-b">
                {r.bookings?.guest_name}
              </td>
              <td className="px-4 py-2 border-b">
                {new Date(r.bookings.check_in).toLocaleDateString('en-GB')}
              </td>
              <td className="px-4 py-2 border-b">
                {new Date(r.bookings.check_out).toLocaleDateString('en-GB')}
              </td>
              <td className="px-4 py-2 border-b text-center">
                {canEdit ? (
                  <button
                    disabled={updatingId === r.booking_id}
                    onClick={() => togglePaid(r)}
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

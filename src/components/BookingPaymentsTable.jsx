import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

function BookingPaymentsTable({ userRole }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortDir, setSortDir] = useState('asc');
  const [updatingId, setUpdatingId] = useState(null);

  const canEdit = ['Admin', 'Payment Manager'].includes(userRole);

  const fetchPayments = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('booking_payments')
      .select(`
        id,
        booking_id,
        booking_ref,
        is_paid,
        bookings (
          guest_name,
          check_in,
          check_out
        )
      `)
      .order('check_in', {
        foreignTable: 'bookings',
        ascending: sortDir === 'asc',
      });

    if (!error) setRows(data || []);
    else console.error('Failed to load booking payments', error);

    setLoading(false);
  };

  useEffect(() => {
    fetchPayments();
  }, [sortDir]);

  const togglePaid = async (row) => {
    if (!canEdit) return;

    setUpdatingId(row.id);

    const { error } = await supabase
      .from('booking_payments')
      .update({ is_paid: !row.is_paid })
      .eq('id', row.id);

    if (error) {
      console.error('Failed to update payment status', error);
      alert('Failed to update payment status.');
    } else {
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id ? { ...r, is_paid: !r.is_paid } : r
        )
      );
    }

    setUpdatingId(null);
  };

  if (loading) {
    return <p className="text-gray-600">Loading payment status…</p>;
  }

  if (rows.length === 0) {
    return <p className="text-gray-600">No bookings found.</p>;
  }

  return (
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
            <tr
              key={r.id}
              className="hover:bg-yellow-50"
            >
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
                    disabled={updatingId === r.id}
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
  );
}

export default BookingPaymentsTable;

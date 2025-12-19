import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

function CleanerTable() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBookings = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from('bookings')
        .select('id, guest_name, check_in, check_out')
        .eq('status', 'approved')
        .order('check_out', { ascending: true });

      if (error) {
        console.error('Error loading cleaner bookings:', error);
      } else {
        setBookings(data || []);
      }

      setLoading(false);
    };

    fetchBookings();
  }, []);

  if (loading) {
    return <p className="text-gray-600">Loading cleaning schedule…</p>;
  }

  if (bookings.length === 0) {
    return <p className="text-gray-600">No upcoming check-outs.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left border border-gray-200">
        <thead className="bg-gray-100 text-gray-700">
          <tr>
            <th className="px-4 py-2 border-b">Check-out</th>
            <th className="px-4 py-2 border-b">Check-in</th>
            <th className="px-4 py-2 border-b">Guest</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => (
            <tr key={b.id}>
              <td className="px-4 py-2 border-b">
                {new Date(b.check_out).toLocaleDateString('en-GB')}
              </td>
              <td className="px-4 py-2 border-b">
                {new Date(b.check_in).toLocaleDateString('en-GB')}
              </td>
              <td className="px-4 py-2 border-b">
                {b.guest_name}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default CleanerTable;

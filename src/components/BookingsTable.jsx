import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

function BookingsTable() {
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('Pending');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const fetchBookings = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('status', filter)
        .order('created_at', { ascending: false });
      if (error) console.error('Error loading bookings:', error);
      else setBookings(data);
      setLoading(false);
    };
    fetchBookings();
  }, [filter]);

  return (
    <section className="mt-8">
      <h3 className="text-2xl font-heading text-primary mb-4">Bookings</h3>

      {/* Filter tabs */}
      <div className="flex gap-3 mb-6">
        {['Pending', 'Approved', 'Rejected'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-md border ${
              filter === s
                ? 'bg-primary text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-600">Loading bookings…</p>
      ) : bookings.length === 0 ? (
        <p className="text-gray-600">No {filter.toLowerCase()} bookings.</p>
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
                    {new Date(b.check_in).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2 border-b">
                    {new Date(b.check_out).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2 border-b text-center">{b.adults}</td>
                  <td className="px-4 py-2 border-b">{b.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal skeleton */}
      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-lg w-full">
            <h4 className="text-xl font-heading text-primary mb-4">
              Booking Details
            </h4>
            <p>
              <strong>Guest:</strong> {selected.guest_name}
            </p>
            <p>
              <strong>Email:</strong> {selected.guest_email}
            </p>
            <p>
              <strong>Check-in:</strong>{' '}
              {new Date(selected.check_in).toLocaleDateString()}
            </p>
            <p>
              <strong>Check-out:</strong>{' '}
              {new Date(selected.check_out).toLocaleDateString()}
            </p>
            <p>
              <strong>Status:</strong> {selected.status}
            </p>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelected(null)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default BookingsTable;

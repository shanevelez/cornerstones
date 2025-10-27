import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

function BookingsTable() {
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('pending');
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
useEffect(() => {
  if (deepLinkId && bookings.length > 0) {
    const match = bookings.find((b) => b.id === Number(deepLinkId));
    if (match) setSelected(match);
  }
}, [deepLinkId, bookings]);

  return (
    <section className="mt-8">
      <h3 className="text-2xl font-heading text-primary mb-4">Bookings</h3>

      {/* Filter tabs */}
      <div className="flex gap-3 mb-6">
        {['pending', 'approved', 'rejected'].map((s) => (
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
                    {new Date(b.check_in).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2 border-b">
                    {new Date(b.check_out).toLocaleDateString()}
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

        <div className="flex flex-col sm:flex-row sm:justify-between">
          <p>
            <span className="font-semibold">Check-in:</span>{' '}
            {new Date(selected.check_in).toLocaleDateString()}
          </p>
          <p>
            <span className="font-semibold">Check-out:</span>{' '}
            {new Date(selected.check_out).toLocaleDateString()}
          </p>
        </div>

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
                : 'bg-yellow-100 text-yellow-700'
            }`}
          >
            {selected.status}
          </span>
        </div>

        {/* Comments + Actions (only if pending) */}
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

              <button
                onClick={async () => {
                  const comment = document.getElementById('comment').value;
                  const { data: session } = await supabase.auth.getSession();
                  const userId = session?.session?.user.id;

                  if (
                    window.confirm('Are you sure you want to reject this booking?')
                  ) {
                    await supabase.from('approvals').insert([
                      {
                        booking_id: selected.id,
                        user_id: userId,
                        action: 'rejected',
                        comment,
                      },
                    ]);

                    await supabase
                      .from('bookings')
                      .update({ status: 'rejected' })
                      .eq('id', selected.id);

                    setSelected(null);
                    window.location.reload(); // quick refresh for now
                  }
                }}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition"
              >
                Reject
              </button>

              <button
                onClick={async () => {
                  const comment = document.getElementById('comment').value;
                  const { data: session } = await supabase.auth.getSession();
                  const userId = session?.session?.user.id;

                  await supabase.from('approvals').insert([
                    {
                      booking_id: selected.id,
                      user_id: userId,
                      action: 'approved',
                      comment,
                    },
                  ]);

                  await supabase
                    .from('bookings')
                    .update({ status: 'approved' })
                    .eq('id', selected.id);

                  setSelected(null);
                  window.location.reload(); // refresh list
                }}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition"
              >
                Approve
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer (only Close button if not pending) */}
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

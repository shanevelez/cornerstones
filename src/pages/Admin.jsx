import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import BookingsTable from '../components/BookingsTable';

function Admin() {
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation(); // ✅ added here
  

  // ---- extract deep link param ----
  const params = new URLSearchParams(location?.search || '');
  const bookingIdFromURL = params.get('booking');

  // ---- helper to fetch user role ----
  const fetchUserRole = async (userId) => {
    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();
    if (error) {
      console.error('Error fetching role:', error);
      return '';
    }
    return data?.role || '';
  };

  // ---- initial session check ----
  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      const current = data?.session;
      if (!current) {
        navigate('/login', { replace: true });
        return;
      }

      setSession(current);
      const role = await fetchUserRole(current.user.id);
      setUserRole(role);
      setLoading(false);
    };

    init();

    // ---- listen for auth changes ----
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        setUserRole('');
        setLoading(false);
        navigate('/login', { replace: true });
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [navigate]);

  // ---- logout handler ----
  const handleSignOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setSession(null);
    setUserRole('');
    setLoading(false);
    navigate('/login', { replace: true });
  };

  function AdminRecommendations() {
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // 👈 for modal

  useEffect(() => {
    const fetchPending = async () => {
      const { data, error } = await supabase
        .from("recommendations")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (!error) setRecs(data);
      setLoading(false);
    };
    fetchPending();
  }, []);

  const handleAction = async (id, action) => {
    try {
      const res = await fetch("/api/approve-recommendation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      if (res.ok) {
        setRecs((prev) => prev.filter((r) => r.id !== id));
        setSelected(null); // close modal on approval/reject
      }
    } catch (err) {
      console.error("Action failed:", err);
    }
  };

  if (loading) return <p>Loading recommendations…</p>;
  if (recs.length === 0)
    return <p className="text-gray-600">No pending recommendations.</p>;

  return (
    <div className="relative">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-left border border-gray-200">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="px-4 py-2 border-b">Name</th>
              <th className="px-4 py-2 border-b">Category</th>
              <th className="px-4 py-2 border-b">Submitted By</th>
              <th className="px-4 py-2 border-b text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {recs.map((r) => (
              <tr
                key={r.id}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => setSelected(r)} // 👈 open modal
              >
                <td className="px-4 py-2 border-b">{r.name}</td>
                <td className="px-4 py-2 border-b">{r.category}</td>
                <td className="px-4 py-2 border-b">{r.submitted_by}</td>
                <td className="px-4 py-2 border-b text-center text-sm text-gray-500">
                  Click for details
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {selected && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl w-full relative border-t-4 border-primary">
            <button
              onClick={() => setSelected(null)}
              className="absolute top-2 right-3 text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>

            <h3 className="text-2xl font-heading text-primary mb-3">
              {selected.name}
            </h3>
            <p className="text-gray-700 mb-2">
              <strong>Category:</strong> {selected.category}
            </p>
            <p className="text-gray-700 mb-2">
              <strong>Address:</strong> {selected.address}
            </p>
            <p className="text-gray-700 mb-4">{selected.description}</p>
            {selected.tags?.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {selected.tags.map((t) => (
                  <span
                    key={t}
                    className="bg-gray-200 text-gray-700 px-2 py-1 rounded text-sm"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}

            {selected.photos?.length > 0 && (
              <div className="grid grid-cols-2 gap-3 mb-6">
                {selected.photos.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`Photo ${i + 1}`}
                    className="w-full h-40 object-cover rounded-md border"
                  />
                ))}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => handleAction(selected.id, "rejected")}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
              >
                Reject
              </button>
              <button
                onClick={() => handleAction(selected.id, "approved")}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



  // ---- UI ----
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600">
        Loading dashboard...
      </div>
    );
  }

  if (!session) return null;

  return (
    <section className="min-h-screen bg-neutralbg p-8">
      <div className="max-w-5xl mx-auto bg-white shadow rounded-lg p-6 border-t-4 border-primary">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-3xl font-heading text-primary">Admin Dashboard</h2>
            <p className="text-gray-600">Logged in as {session.user.email}</p>
            <p className="text-gray-600 text-sm mt-1">Role: {userRole}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="bg-primary text-white px-4 py-2 rounded-md shadow hover:bg-yellow-500 transition"
          >
            Sign Out
          </button>
        </div>

        {/* Role-based content */}
        {userRole === 'Admin' && (
          <div>
            <h3 className="text-xl font-heading text-primary mb-3">Full Access</h3>
            <p className="text-gray-700 mb-6">
              You can manage bookings, recommendations, and users here (coming soon).
            </p>
            <BookingsTable deepLinkId={bookingIdFromURL} /> {/* ✅ added prop */}
          </div>
        )}

        {userRole === 'Approver' && (
          <div>
            <h3 className="text-xl font-heading text-primary mb-3">Bookings Approvals</h3>
            <p className="text-gray-700 mb-6">
              You can view and approve bookings here.
            </p>
            <BookingsTable deepLinkId={bookingIdFromURL} /> {/* ✅ same prop */}
          </div>
        )}

        {!['Admin', 'Approver'].includes(userRole) && (
          <div className="text-red-600 font-semibold">
            Your account doesn’t have permission to access this dashboard.
          </div>
        )}
        {userRole === "Admin" && (
  <div className="mt-12">
    <h3 className="text-2xl font-heading text-primary mb-4">
      Local Recommendations – Pending Approval
    </h3>

    <AdminRecommendations />
  </div>
)}

      </div>
    </section>
  );
}

export default Admin;

import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import BookingsTable from '../components/BookingsTable';
import CleanerTable from '../components/CleanerTable';


function Admin() {
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const [modalLoading, setModalLoading] = useState(false);

  // --- Read booking deep link from URL
  const params = new URLSearchParams(location?.search || '');
  const [deepLinkId, setDeepLinkId] = useState(params.get('booking'));

  // --- Remove ?booking= param from URL once it's consumed
  useEffect(() => {
    if (deepLinkId === null) {
      const newUrl = new URL(window.location);
      newUrl.searchParams.delete('booking');
      window.history.replaceState({}, '', newUrl);
    }
  }, [deepLinkId]);

  // --- Fetch user role
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

  // --- Init session + role
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

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (!session) {
          setUserRole('');
          setLoading(false);
          navigate('/login', { replace: true });
        }
      }
    );

    return () => listener.subscription.unsubscribe();
  }, [navigate]);

  // --- Sign out
  const handleSignOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setSession(null);
    setUserRole('');
    setLoading(false);
    navigate('/login', { replace: true });
  };

  // --- Admin Recommendations subcomponent (unchanged)
  function AdminRecommendations() {
    const [recs, setRecs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [edit, setEdit] = useState(null);

    useEffect(() => {
      const fetchPending = async () => {
        const { data, error } = await supabase
          .from('recommendations')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: false });
        if (!error) setRecs(data);
        setLoading(false);
      };
      fetchPending();
    }, []);

    const handleAction = async (id, action) => {
      setModalLoading(true);
      try {
        const res = await fetch('/api/approve-recommendation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, action }),
        });
        if (res.ok) {
          setRecs((prev) => prev.filter((r) => r.id !== id));
          setSelected(null);
          setEdit(null);
        }
      } catch (err) {
        console.error('Action failed:', err);
      } finally {
        setModalLoading(false);
      }
    };

    const saveEdits = async (id, fields) => {
      setModalLoading(true);
      try {
        const formData = new FormData();
        formData.append('id', id);
        Object.entries(fields).forEach(([key, val]) => {
          if (Array.isArray(val)) {
            formData.append(key, JSON.stringify(val));
          } else {
            formData.append(key, val ?? '');
          }
        });

        const res = await fetch('/api/update-recommendation', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) throw new Error('Failed to update');
        const data = await res.json();

        setSelected(data.recommendation);
        alert('Changes saved');
      } catch (err) {
        console.error('Save error:', err);
      } finally {
        setModalLoading(false);
      }
    };

    if (loading) return <p>Loading recommendations…</p>;
    if (recs.length === 0)
      return <p className="text-gray-600">No pending recommendations.</p>;

    return (
      <div className="relative">
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
                  onClick={() => {
                    setSelected(r);
                    setEdit({ ...r });
                  }}
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

        {selected && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
            {modalLoading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl w-full relative border-t-4 border-primary overflow-y-auto max-h-[90vh]">
              <button
                onClick={() => {
                  setSelected(null);
                  setEdit(null);
                }}
                className="absolute top-2 right-3 text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>

              <h3 className="text-2xl font-heading text-primary mb-1">
                Edit Recommendation
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Submitted by {edit.submitted_by}
              </p>

              <label className="block font-semibold mb-1">Name</label>
              <input
                value={edit.name}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                className="border w-full p-2 rounded mb-3"
              />

              <label className="block font-semibold mb-1">Category</label>
              <input
                value={edit.category}
                onChange={(e) => setEdit({ ...edit, category: e.target.value })}
                className="border w-full p-2 rounded mb-3"
              />

              <label className="block font-semibold mb-1">Address</label>
              <input
                value={edit.address}
                onChange={(e) => setEdit({ ...edit, address: e.target.value })}
                className="border w-full p-2 rounded mb-3"
              />

              <label className="block font-semibold mb-1">Description</label>
              <textarea
                value={edit.description}
                onChange={(e) =>
                  setEdit({ ...edit, description: e.target.value })
                }
                rows={6}
                className="border w-full p-2 rounded mb-4 whitespace-pre-line"
              />

              {edit.tags?.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2">
                  {edit.tags.map((t) => (
                    <span
                      key={t}
                      className="bg-gray-200 text-gray-700 px-2 py-1 rounded text-sm"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {edit.photos?.length > 0 && (
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {edit.photos.map((url, i) => (
                    <div key={i} className="relative">
                      <img
                        src={url}
                        alt={`Photo ${i + 1}`}
                        className="w-full h-40 object-cover rounded-md border"
                      />
                      <button
                        onClick={() =>
                          setEdit({
                            ...edit,
                            photos: edit.photos.filter((_, idx) => idx !== i),
                          })
                        }
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full px-2 text-sm"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between items-center">
                <button
                  onClick={() => saveEdits(edit.id, edit)}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Save Changes
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleAction(edit.id, 'rejected')}
                    className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleAction(edit.id, 'approved')}
                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                  >
                    Approve
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- Loading / auth guard
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600">
        Loading dashboard...
      </div>
    );
  }

  if (!session) return null;

  // --- Render
  return (
    <section className="min-h-screen bg-neutralbg p-4 sm:p-8">
      <div className="max-w-5xl mx-auto bg-white shadow rounded-lg p-4 sm:p-6 border-t-4 border-primary">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4 sm:gap-0">
          <div className="text-center sm:text-left">
            <h2 className="text-2xl sm:text-3xl font-heading text-primary">
              Admin Dashboard
            </h2>
            <p className="text-gray-600 break-all">
              Logged in as {session.user.email}
            </p>
            <p className="text-gray-600 text-sm mt-1">Role: {userRole}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="bg-primary text-white px-4 py-2 rounded-md shadow hover:bg-yellow-500 transition w-full sm:w-auto"
          >
            Sign Out
          </button>
        </div>

        {userRole === 'Admin' && (
          <div>
            <h3 className="text-lg sm:text-xl font-heading text-primary mb-3">
              Full Access
            </h3>
            <p className="text-gray-700 mb-6 text-sm sm:text-base">
              You can manage bookings, recommendations, and users here (coming soon).
            </p>
            <div className="overflow-x-auto">
              <BookingsTable
                deepLinkId={deepLinkId}
                setDeepLinkId={setDeepLinkId}
                userRole={userRole}
              />
            </div>
          </div>
        )}

        {userRole === 'Approver' && (
          <div>
            <h3 className="text-lg sm:text-xl font-heading text-primary mb-3">
              Bookings Approvals
            </h3>
            <p className="text-gray-700 mb-6 text-sm sm:text-base">
              You can view and approve bookings here.
            </p>
            <div className="overflow-x-auto">
              <BookingsTable
                deepLinkId={deepLinkId}
                setDeepLinkId={setDeepLinkId}
                userRole={userRole}
              />
            </div>
          </div>
        )}

        {!['Admin', 'Approver'].includes(userRole) && (
          <div className="text-red-600 font-semibold text-center sm:text-left">
            Your account doesn’t have permission to access this dashboard.
          </div>
        )}
{['Admin', 'Cleaner'].includes(userRole) && (
  <div className="mt-12">
    <h3 className="text-xl font-heading text-primary mb-3">
      Cleaning Schedule
    </h3>
    <CleanerTable />
  </div>
)}

        {userRole === 'Admin' && (
          <div className="mt-12">
            <h3 className="text-xl sm:text-2xl font-heading text-primary mb-4">
              Local Recommendations – Pending Approval
            </h3>
            <div className="overflow-x-auto">
              <AdminRecommendations />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default Admin;

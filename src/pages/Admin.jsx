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
      </div>
    </section>
  );
}

export default Admin;

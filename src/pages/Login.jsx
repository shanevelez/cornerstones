import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

function Admin() {
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
      // 1️⃣ Check session
      const { data: sessionData } = await supabase.auth.getSession();
      const currentSession = sessionData?.session;

      if (!currentSession) {
        navigate('/login');
        return;
      }

      setSession(currentSession);

      // 2️⃣ Fetch role from users table
      const userId = currentSession.user.id;
      const { data: userData, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user role:', error);
      } else {
        setUserRole(userData.role);
      }

      setLoading(false);
    };

    init();

    // 3️⃣ Watch auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate('/login');
      setSession(session);
    });

    return () => listener.subscription.unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600">
        Loading dashboard...
      </div>
    );
  }

  if (!session) return null;

  const email = session.user.email;

  return (
    <section className="min-h-screen bg-neutralbg p-8">
      <div className="max-w-5xl mx-auto bg-white shadow rounded-lg p-6 border-t-4 border-primary">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-3xl font-heading text-primary">Admin Dashboard</h2>
            <p className="text-gray-600">Logged in as {email}</p>
            <p className="text-gray-600 text-sm mt-1">Role: {userRole}</p>
          </div>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate('/login');
            }}
            className="bg-primary text-white px-4 py-2 rounded-md shadow hover:bg-yellow-500 transition"
          >
            Sign Out
          </button>
        </div>

        {/* Role-based content */}
        {userRole === 'Admin' && (
          <div>
            <h3 className="text-xl font-heading text-primary mb-3">Full Access</h3>
            <p className="text-gray-700">
              You can manage bookings, recommendations, and users here (coming soon).
            </p>
          </div>
        )}

        {userRole === 'Approver' && (
          <div>
            <h3 className="text-xl font-heading text-primary mb-3">Bookings Approvals</h3>
            <p className="text-gray-700">
              You can view and approve bookings here (bookings table coming next).
            </p>
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

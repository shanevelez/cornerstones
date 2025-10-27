import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

function Admin() {
  const [session, setSession] = useState(null);
  const navigate = useNavigate();

  // Check for existing session on mount
  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        navigate('/login'); // no session → go to login
      } else {
        setSession(data.session);
      }
    };
    getSession();

    // Listen for auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate('/login');
      setSession(session);
    });

    return () => listener.subscription.unsubscribe();
  }, [navigate]);

  if (!session) return <p>Loading...</p>;

  return (
    <section style={{ padding: '2rem' }}>
      <h2>Admin Dashboard</h2>
      <p>Welcome, {session.user.email}</p>
      <button
        onClick={async () => {
          await supabase.auth.signOut();
          navigate('/login');
        }}
      >
        Sign out
      </button>
    </section>
  );
}

export default Admin;

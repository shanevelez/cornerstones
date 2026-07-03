import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function AcceptInvite() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleCreatePassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // 1. Update the password using the active session token from the email link
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
    } else {
      // 2. Redirect straight to the admin page (they are already authenticated)
      navigate('/admin');
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f9f9f9' }}>
      <div style={{ background: '#fff', padding: '30px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxWidth: '400px', width: '100%' }}>
        <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#333' }}>Create Your Password</h2>
        
        <form onSubmit={handleCreatePassword}>
          <input 
            type="password" 
            placeholder="Enter secure password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)}
            required 
            style={{ display: 'block', width: '100%', marginBottom: '15px', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
          />
          <button type="submit" disabled={loading} style={{ width: '100%', padding: '10px', background: '#000', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            {loading ? 'Saving...' : 'Save Password & Continue'}
          </button>
        </form>

        {error && <p style={{ marginTop: '15px', color: '#d9534f' }}>{error}</p>}
      </div>
    </div>
  );
}
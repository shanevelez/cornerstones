import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setMessage(`Welcome ${data.user.email}`);
      navigate('/admin');
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setMessage('Check your email for the confirmation link.');
    }
  };

  return (
    <section className="flex items-center justify-center min-h-screen bg-neutralbg px-6">
      <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-md border-t-4 border-primary">
        <h2 className="text-3xl font-heading text-center text-primary mb-6">
          Admin Login
        </h2>

        <form className="space-y-4">
          <div>
            <label className="block font-sans text-sm text-text mb-1">
              Email
            </label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          <div>
            <label className="block font-sans text-sm text-text mb-1">
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          {error && (
            <p className="text-red-600 font-sans text-sm text-center">{error}</p>
          )}
          {message && (
            <p className="text-green-600 font-sans text-sm text-center">
              {message}
            </p>
          )}

          <div className="flex justify-center gap-3 mt-6">
            <button
              onClick={handleLogin}
              disabled={loading}
              className="bg-primary text-white font-sans text-lg px-6 py-2 rounded-md shadow hover:bg-yellow-500 transition"
            >
              {loading ? 'Loading...' : 'Log In'}
            </button>
            <button
              onClick={handleSignup}
              disabled={loading}
              className="bg-gray-200 text-text font-sans text-lg px-6 py-2 rounded-md shadow hover:bg-primary hover:text-white transition"
            >
              {loading ? 'Loading...' : 'Sign Up'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

export default Login;

import { useEffect, useState } from 'react';

export default function Unsubscribe() {
  const [status, setStatus] = useState('processing'); // processing | success | error

  useEffect(() => {
    // 1. Get the ID from the browser URL params
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');

    if (!id) {
      setStatus('error');
      return;
    }

    // 2. Call our API to do the unsubscribe
    const doUnsubscribe = async () => {
      try {
        const res = await fetch(`/api/unsubscribe?id=${id}`);
        if (!res.ok) throw new Error('Failed');
        setStatus('success');
      } catch (err) {
        setStatus('error');
      }
    };

    doUnsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-[#f4f4f4] flex items-center justify-center p-4 font-sans">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center border-t-4 border-[#f4b400]">
        
        {/* Loading State */}
        {status === 'processing' && (
          <div className="py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#f4b400] mx-auto mb-4"></div>
            <p className="text-gray-600">Unsubscribing you...</p>
          </div>
        )}

        {/* Success State */}
        {status === 'success' && (
          <div className="animate-fade-in">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
              ✓
            </div>
            <h1 className="text-2xl font-bold text-[#0f2b4c] mb-2">You've been unsubscribed</h1>
            <p className="text-gray-600 mb-6">
              You won't receive any more weather alerts from us.
            </p>
            <a href="/" className="text-[#f4b400] font-bold hover:underline">
              Return to Homepage
            </a>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div>
             <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
              !
            </div>
            <h1 className="text-xl font-bold text-[#0f2b4c] mb-2">Something went wrong</h1>
            <p className="text-gray-600 mb-6">
              We couldn't find your subscription details. You might already be unsubscribed.
            </p>
            <a href="/" className="text-gray-400 text-sm hover:underline">
              Go Home
            </a>
          </div>
        )}

      </div>
    </div>
  );
}
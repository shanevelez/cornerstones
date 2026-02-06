import { useState } from "react";
import Navbar from "../components/Navbar";
import { supabase } from "../supabaseClient";
import { SunIcon, EnvelopeIcon, CheckCircleIcon } from "@heroicons/react/24/outline";

function Subscribe() {
  const [formData, setFormData] = useState({ name: "", email: "", consent: false });
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    // 1. Validation
    if (!formData.name || !formData.email) {
      setErrorMessage("Please fill in your name and email.");
      setStatus("error");
      return;
    }

    if (!formData.consent) {
      setErrorMessage("You must consent to receive emails to join the list.");
      setStatus("error");
      return;
    }

    setStatus("loading");

    try {
      // 2. Insert into Supabase
      const { error } = await supabase
        .from("subscribers")
        .insert([
          {
            name: formData.name,
            email: formData.email,
            status: "active",
          },
        ]);

      if (error) {
        // Unique violation code (Postgres)
        if (error.code === "23505") {
          throw new Error("This email is already subscribed!");
        }
        throw error;
      }

      setStatus("success");
      setFormData({ name: "", email: "", consent: false });

    } catch (err) {
      console.error("Subscription error:", err);
      setErrorMessage(err.message || "Something went wrong. Please try again.");
      setStatus("error");
    }
  };

  return (
    <>
      <Navbar />

      <main className="max-w-5xl mx-auto px-6 py-10 min-h-[80vh] flex flex-col items-center">
        
        {/* --- HEADER SECTION --- */}
        <div className="text-center mb-10 max-w-2xl">
          <div className="flex justify-center mb-4">
            <div className="bg-yellow-100 p-3 rounded-full">
              <SunIcon className="w-10 h-10 text-yellow-600" />
            </div>
          </div>
          <h2 className="text-4xl font-heading text-primary mb-3">
            Seize the Ray ☀️
          </h2>
          <p className="text-gray-700 text-lg">
            Don't miss a sunny week in Crantock.
          </p>
          <p className="text-gray-600 mt-2">
            We check the forecast every Wednesday. If the upcoming week looks glorious (and the cottage is free), we'll send you a quick alert so you can book a spontaneous getaway.
          </p>
        </div>

        {/* --- FORM SECTION --- */}
        <div className="w-full max-w-md bg-white shadow-lg rounded-lg overflow-hidden border">
          
          {status === "success" ? (
            <div className="p-8 text-center animate-fade-in">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
                <CheckCircleIcon className="h-10 w-10 text-green-600" />
              </div>
              <h3 className="text-2xl font-heading text-primary mb-2">You're on the list!</h3>
              <p className="text-gray-600 mb-6">
                Fingers crossed for some sunshine. Keep an eye on your inbox on Wednesdays.
              </p>
              <button
                onClick={() => setStatus("idle")}
                className="text-primary hover:text-yellow-600 font-medium underline"
              >
                Subscribe another person
              </button>
            </div>
          ) : (
            <div className="p-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                
                {/* Name Input */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none transition"
                    placeholder="Jane"
                    disabled={status === "loading"}
                  />
                </div>

                {/* Email Input */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <EnvelopeIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="email"
                      id="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full pl-10 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none transition"
                      placeholder="jane@example.com"
                      disabled={status === "loading"}
                    />
                  </div>
                </div>

                {/* Consent Checkbox */}
                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id="consent"
                      type="checkbox"
                      checked={formData.consent}
                      onChange={(e) => setFormData({ ...formData, consent: e.target.checked })}
                      className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-yellow-500"
                      disabled={status === "loading"}
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="consent" className="font-medium text-gray-700">
                      I consent to receive weather alerts
                    </label>
                    <p className="text-gray-500 text-xs mt-1">
                      We only email on Wednesdays, only if it's sunny, and only if we have availability. You can unsubscribe at any time.
                    </p>
                  </div>
                </div>

                {/* Error Message */}
                {status === "error" && (
                  <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm border border-red-200">
                    {errorMessage}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="w-full bg-primary text-white py-3 px-4 rounded-md shadow hover:bg-yellow-500 hover:text-white transition duration-200 font-medium disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center"
                >
                  {status === "loading" ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Signing up...
                    </>
                  ) : (
                    "Notify Me"
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

export default Subscribe;
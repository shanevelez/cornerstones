import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import { supabase } from "../supabaseClient";
import SubmitRecommendation from "./SubmitRecommendation";

function LocalRecs() {
  const [recs, setRecs] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState("All");

  const categories = ["All", "Dining", "Nature", "Activities", "Shops", "Hidden Gems"];

  useEffect(() => {
    const fetchApproved = async () => {
      let query = supabase
        .from("recommendations")
        .select("*")
        .eq("status", "approved")
        .order("created_at", { ascending: false });

      if (category !== "All") {
        query = query.eq("category", category);
      }

      const { data, error } = await query;
      if (!error) setRecs(data);
    };
    fetchApproved();
  }, [category]);

  return (
    <>
      <Navbar />

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="text-center mb-10">
          <h2 className="text-4xl font-heading text-primary mb-3">
            Local Recommendations
          </h2>
          <p className="text-gray-700 mb-6">
            Explore places loved by our guests — or share your own favourite spot.
          </p>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-primary text-white px-6 py-2 rounded-md shadow hover:bg-yellow-500 transition"
          >
            {showForm ? "Hide Form" : "Share a Recommendation"}
          </button>
        </div>

        {/* Expand/collapse form */}
        {showForm && (
          <div className="mb-12 border-t pt-8">
            <SubmitRecommendation />
          </div>
        )}

        {/* Category filter bar */}
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-4 py-2 rounded-full border text-sm font-medium transition ${
                category === c
                  ? "bg-primary text-white"
                  : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Approved recommendations grid */}
        <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {recs.map((rec) => (
            <div
              key={rec.id}
              className="bg-white shadow rounded-lg overflow-hidden border hover:shadow-lg transition"
            >
              <img
                src={rec.photos?.[0]}
                alt={rec.name}
                className="w-full h-56 object-cover"
              />
              <div className="p-4">
                <h3 className="text-xl font-heading text-primary mb-2">{rec.name}</h3>
                {rec.address && <p className="text-sm text-gray-600 mb-2">{rec.address}</p>}
                <p className="text-gray-700 text-sm mb-3">{rec.description}</p>
                {rec.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {rec.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {recs.length === 0 && (
            <p className="text-gray-600 col-span-full text-center">
              No {category === "All" ? "" : category.toLowerCase()} recommendations yet.
            </p>
          )}
        </section>
      </main>
    </>
  );
}

export default LocalRecs;

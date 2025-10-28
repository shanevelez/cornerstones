import { useState, useEffect } from "react";
import { MapPinIcon } from "@heroicons/react/24/solid";
import Navbar from "../components/Navbar";
import { supabase } from "../supabaseClient";
import SubmitRecommendation from "./SubmitRecommendation";

function LocalRecs() {
  const [recs, setRecs] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState("All");
  const [selected, setSelected] = useState(null); // main modal
  const [fullImage, setFullImage] = useState(null); // 👈 full-size photo viewer

  const categories = ["All", "Dining", "Nature", "Activities", "Shops", "Hidden Gems"];

  useEffect(() => {
    const fetchApproved = async () => {
      let query = supabase
        .from("recommendations")
        .select("*")
        .eq("status", "approved")
        .order("created_at", { ascending: false });

      if (category !== "All") query = query.eq("category", category);

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

        {/* Expandable form */}
        <div className="mb-12 border-t pt-8">
          <SubmitRecommendation isVisible={showForm} />
        </div>

        {/* Category bar */}
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

        {/* Grid of cards */}
        <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {recs.map((rec) => (
            <div
              key={rec.id}
              onClick={() => setSelected(rec)} // 👈 open modal
              className="bg-white shadow rounded-lg overflow-hidden border hover:shadow-lg transition cursor-pointer"
            >
              {rec.photos?.length > 0 ? (
                <img
                  src={rec.photos[0]}
                  alt={rec.name}
                  className="w-full h-56 object-cover"
                />
              ) : (
                <div className="w-full h-56 bg-gray-200 flex items-center justify-center text-gray-500 text-sm">
                  No Image
                </div>
              )}
              <div className="p-4">
                <h3 className="text-xl font-heading text-primary mb-2">{rec.name}</h3>
                {rec.address && (
                  <p className="flex items-center text-sm text-gray-600 mb-2">
                    <MapPinIcon className="w-4 h-4 text-primary mr-1" />
                    {rec.address}
                  </p>
                )}
                <p className="text-gray-700 text-sm line-clamp-3 whitespace-pre-line">
                  {rec.description}
                </p>
                {rec.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
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

      {/* Modal for recommendation details */}
      {selected && (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    onClick={() => setSelected(null)} // 👈 click outside closes
  >
    <div
      className="bg-white rounded-lg shadow-lg max-w-lg w-full relative overflow-y-auto max-h-[90vh]"
      onClick={(e) => e.stopPropagation()} // 👈 prevent closing when clicking inside modal
    >
      {/* the X button sits *above* everything */}
      <button
        onClick={() => setSelected(null)}
        className="absolute top-2 right-3 z-20 text-gray-100 bg-black/40 hover:bg-black/60 rounded-full w-7 h-7 flex items-center justify-center text-lg"
        aria-label="Close"
      >
        ×
      </button>

      {selected.photos?.length > 0 && (
        <img
          src={selected.photos[0]}
          alt={selected.name}
          onClick={() => setFullImage(selected.photos[0])}
          className="w-full h-56 object-cover rounded-t-lg cursor-pointer"
        />
      )}

      <div className="p-6">
        <h3 className="text-2xl font-heading text-primary mb-2">{selected.name}</h3>
        <p className="text-sm text-gray-500 mb-4">
          Category: {selected.category}
        </p>

        {selected.address && (
          <p className="flex items-center text-gray-700 mb-3 text-sm">
            <MapPinIcon className="w-4 h-4 text-primary mr-1" />
            {selected.address}
          </p>
        )}

        <p className="text-gray-700 whitespace-pre-line mb-4">
          {selected.description}
        </p>

        {selected.photos?.length > 1 && (
          <div className="grid grid-cols-2 gap-2 mb-4">
            {selected.photos.slice(1).map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`${selected.name} ${i + 2}`}
                onClick={() => setFullImage(url)}
                className="w-full h-36 object-cover rounded cursor-pointer"
              />
            ))}
          </div>
        )}

        {selected.tags?.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {selected.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {selected.submitted_by && (
          <p className="text-xs text-gray-500">
            Submitted by {selected.submitted_by}
          </p>
        )}
      </div>
    </div>
  </div>
)}


      {/* Full-size photo viewer */}
      {fullImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setFullImage(null)}
        >
          <img
            src={fullImage}
            alt="Full size"
            className="max-h-full max-w-full rounded-lg shadow-lg"
          />
        </div>
      )}
    </>
  );
}

export default LocalRecs;

import { useState } from "react";
import { supabase } from "../supabaseClient";
import imageCompression from "browser-image-compression";

const categoryOptions = ["Dining", "Nature", "Activities", "Shops", "Hidden Gems", "General"];
const tagOptions = [
  "Family Friendly",
  "Dog Friendly",
  "Beach View",
  "Scenic Walk",
  "Local Produce",
  "Live Music",
  "Sunset Spot",
];

function SubmitRecommendation() {
  const [form, setForm] = useState({
    name: "",
    address: "",
    description: "",
  });
  const [category, setCategory] = useState("General");
  const [tags, setTags] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files).slice(0, 4);
    setFiles(selected);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      // Optional photo upload
      const uploadedUrls = [];
      if (files.length > 0) {
        for (const file of files) {
          const compressed = await imageCompression(file, {
            maxWidthOrHeight: 1920,
            maxSizeMB: 0.5,
          });

          const filePath = `uploads/${Date.now()}-${file.name}`;
          const { error: uploadError } = await supabase.storage
            .from("recommendations")
            .upload(filePath, compressed);

          if (uploadError) throw uploadError;

          const { data: publicUrlData } = supabase.storage
            .from("recommendations")
            .getPublicUrl(filePath);

          uploadedUrls.push(publicUrlData.publicUrl);
        }
      }

      // Insert record into Supabase
      const { error: insertError } = await supabase.from("recommendations").insert([
        {
          name: form.name,
          address: form.address,
          description: form.description,
          category,
          tags,
          photos: uploadedUrls,
          status: "pending",
        },
      ]);

      if (insertError) throw insertError;

      setMessage("Recommendation submitted! Awaiting admin approval.");
      setForm({ name: "", address: "", description: "" });
      setFiles([]);
      setTags([]);
      setCategory("General");
    } catch (err) {
      console.error("Submit error:", err);
      setMessage(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="max-w-3xl mx-auto p-6">
      <h2 className="text-3xl font-heading text-primary mb-6 text-center">
        Submit a Local Recommendation
      </h2>

      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-6 space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-semibold mb-1">Name *</label>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            className="border w-full p-2 rounded-md"
          />
        </div>

        {/* Address */}
        <div>
          <label className="block text-sm font-semibold mb-1">Address</label>
          <input
            name="address"
            value={form.address}
            onChange={handleChange}
            className="border w-full p-2 rounded-md"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-semibold mb-1">Description *</label>
          <textarea
            name="description"
            rows="4"
            value={form.description}
            onChange={handleChange}
            required
            className="border w-full p-2 rounded-md"
          />
        </div>

        {/* Category dropdown */}
        <div>
          <label className="block text-sm font-semibold mb-1">Category *</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
            className="border w-full p-2 rounded-md"
          >
            {categoryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Tags checkboxes */}
        <div>
          <label className="block text-sm font-semibold mb-1">
            Tags (select all that apply)
          </label>
          <div className="flex flex-wrap gap-3">
            {tagOptions.map((tag) => (
              <label key={tag} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={tags.includes(tag)}
                  onChange={(e) => {
                    if (e.target.checked) setTags((prev) => [...prev, tag]);
                    else setTags((prev) => prev.filter((t) => t !== tag));
                  }}
                />
                {tag}
              </label>
            ))}
          </div>
        </div>

        {/* Photos (optional) */}
        <div>
          <label className="block text-sm font-semibold mb-1">Photos (optional, up to 4)</label>
          <input type="file" accept="image/*" multiple onChange={handleFileChange} />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="bg-primary text-white px-6 py-2 rounded-md hover:bg-yellow-500 transition"
        >
          {loading ? "Submitting..." : "Submit"}
        </button>

        {message && (
          <p className="text-center mt-4 text-gray-700 font-medium">{message}</p>
        )}
      </form>
    </section>
  );
}

export default SubmitRecommendation;

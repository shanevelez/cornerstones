import { useState } from "react";
import imageCompression from "browser-image-compression";

const categoryOptions = [
  "Dining",
  "Nature",
  "Activities",
  "Shops",
  "Hidden Gems",
  "General",
];
const tagOptions = [
  "Family Friendly",
  "Dog Friendly",
  "Beach View",
  "Scenic Walk",
  "Local Produce",
  "Live Music",
  "Sunset Spot",
];

function SubmitRecommendation({ isVisible }) {
  const [form, setForm] = useState({ name: "", address: "", description: "" });
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
    const uploadedUrls = [];

    // compress + upload to Supabase storage first
    if (files.length > 0) {
      for (const file of files) {
        const compressed = await imageCompression(file, {
          maxWidthOrHeight: 1920,
          maxSizeMB: 0.5,
        });

        const filePath = `uploads/${Date.now()}-${file.name}`;
        const { data, error } = await supabase.storage
          .from("recommendations")
          .upload(filePath, compressed);

        if (error) throw error;

        const { data: publicUrlData } = supabase.storage
          .from("recommendations")
          .getPublicUrl(filePath);

        uploadedUrls.push(publicUrlData.publicUrl);
      }
    }

    // ✅ JSON POST
    const res = await fetch("/api/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        address: form.address,
        description: form.description,
        category,
        tags,
        photos: uploadedUrls,
      }),
    });

    if (!res.ok) throw new Error(`API ${res.status}`);
    setMessage("Recommendation submitted! Awaiting approval.");
  } catch (err) {
    console.error("Submit error:", err);
    setMessage(err.message);
  } finally {
    setLoading(false);
  }
};


  return (
    <div
      className={`transition-all duration-500 ease-in-out transform ${
        isVisible
          ? "max-h-[1500px] opacity-100 translate-y-0"
          : "max-h-0 opacity-0 -translate-y-4"
      } overflow-hidden`}
    >
      <form
        onSubmit={handleSubmit}
        className="bg-white shadow-md rounded-lg p-6 space-y-4"
      >
        <div>
          <label className="block text-sm font-semibold mb-1">Place Name *</label>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            className="border w-full p-2 rounded-md"
            placeholder="e.g. The Bowgie Inn"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">Address</label>
          <input
            name="address"
            value={form.address}
            onChange={handleChange}
            className="border w-full p-2 rounded-md"
            placeholder="Optional"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">Description *</label>
          <textarea
            name="description"
            rows="4"
            value={form.description}
            onChange={handleChange}
            required
            className="border w-full p-2 rounded-md"
            placeholder="Describe what makes this place worth visiting..."
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">Category *</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
            className="border w-full p-2 rounded-md"
          >
            {categoryOptions.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>

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
                    if (e.target.checked)
                      setTags((prev) => [...prev, tag]);
                    else setTags((prev) => prev.filter((t) => t !== tag));
                  }}
                />
                {tag}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">
            Photos (optional, up to 4)
          </label>
          <label
            htmlFor="fileInput"
            className="inline-block bg-gray-100 text-gray-700 border border-gray-300 text-sm px-3 py-1.5 rounded-md cursor-pointer hover:bg-gray-200 transition"
          >
            {files.length > 0 ? `${files.length} selected` : "Select Photos"}
          </label>
          <input
            id="fileInput"
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

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
    </div>
  );
}

export default SubmitRecommendation;

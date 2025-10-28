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
  const [form, setForm] = useState({
    name: "",
    address: "",
    description: "",
    submitted_by: "", // 👈 NEW
  });
  const [category, setCategory] = useState("General");
  const [tags, setTags] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleFileChange = (e) =>
    setFiles(Array.from(e.target.files).slice(0, 4));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("name", form.name);
      formData.append("address", form.address);
      formData.append("description", form.description);
      formData.append("category", category);
      formData.append("tags", JSON.stringify(tags));
      formData.append("submitted_by", form.submitted_by); // 👈 NEW

      // compress locally before sending
      for (const file of files) {
        const compressed = await imageCompression(file, {
          maxWidthOrHeight: 1920,
          maxSizeMB: 0.5,
        });
        formData.append("photos", compressed, file.name);
      }

      const res = await fetch("/api/recommendations", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error(`API ${res.status}`);
      setMessage("Recommendation submitted! Awaiting approval.");
      setForm({
        name: "",
        address: "",
        description: "",
        submitted_by: "",
      });
      setFiles([]);
      setTags([]);
      setCategory("General");
    } catch (err) {
      console.error(err);
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`transition-all duration-500 ease-in-out transform ${
        isVisible ? "max-h-[1500px] opacity-100" : "max-h-0 opacity-0"
      } overflow-hidden`}
    >
      {loading && (
  <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
    <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
  </div>
)}
      <form
        onSubmit={handleSubmit}
        className="bg-white shadow-md rounded-lg p-6 space-y-4"
      >
        {/* 👇 New Field */}
        <div>
          <label className="block font-semibold mb-1">Your Name *</label>
          <input
            name="submitted_by"
            value={form.submitted_by}
            onChange={handleChange}
            required
            className="border w-full p-2 rounded-md"
            placeholder="Your name"
          />
        </div>

        <div>
          <label className="block font-semibold mb-1">Place Name *</label>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            className="border w-full p-2 rounded-md"
          />
        </div>

        <div>
          <label className="block font-semibold mb-1">Address</label>
          <input
            name="address"
            value={form.address}
            onChange={handleChange}
            className="border w-full p-2 rounded-md"
          />
        </div>

        <div>
          <label className="block font-semibold mb-1">Description *</label>
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
          <label className="block font-semibold mb-1">Category *</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="border w-full p-2 rounded-md"
          >
            {categoryOptions.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-semibold mb-1">Tags</label>
          <div className="flex flex-wrap gap-3">
            {tagOptions.map((tag) => (
              <label key={tag} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={tags.includes(tag)}
                  onChange={(e) =>
                    setTags((prev) =>
                      e.target.checked
                        ? [...prev, tag]
                        : prev.filter((t) => t !== tag)
                    )
                  }
                />
                {tag}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block font-semibold mb-1">
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

        {message && <p className="text-center mt-4">{message}</p>}
      </form>
    </div>
  );
}

export default SubmitRecommendation;

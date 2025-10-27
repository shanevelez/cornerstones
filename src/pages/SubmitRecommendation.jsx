import { useState } from "react";
import { supabase } from "../supabaseClient";
import imageCompression from "browser-image-compression";

function SubmitRecommendation() {
  const [form, setForm] = useState({
    name: "",
    address: "",
    description: "",
  });
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
      if (files.length === 0) throw new Error("At least one photo is required");

      // compress + upload each photo
      const uploadedUrls = [];
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

      // insert into recommendations table
      const { error: insertError } = await supabase.from("recommendations").insert([
        {
          name: form.name,
          address: form.address,
          description: form.description,
          photos: uploadedUrls,
          status: "pending",
        },
      ]);

      if (insertError) throw insertError;

      setMessage("Recommendation submitted! Awaiting admin approval.");
      setForm({ name: "", address: "", description: "" });
      setFiles([]);
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

        <div>
          <label className="block text-sm font-semibold mb-1">Address</label>
          <input
            name="address"
            value={form.address}
            onChange={handleChange}
            className="border w-full p-2 rounded-md"
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
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">
            Photos (1–4, at least 1 required)
          </label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            required
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
    </section>
  );
}

export default SubmitRecommendation;

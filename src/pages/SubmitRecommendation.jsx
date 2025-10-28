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

      // Compress and upload to Supabase
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

      // Submit metadata to backend
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
      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-6 space-y-4">
        {/* fields identical as before */}
      </form>
    </div>
  );
}

export default SubmitRecommendation;

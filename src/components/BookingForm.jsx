import { useRef, useState, useEffect } from "react";
import { format, differenceInCalendarDays } from "date-fns";
import { enGB } from "date-fns/locale";
import { supabase } from "../supabaseClient";
import BookingCalendar from "./BookingCalendar";

// ---- helpers ----
const dateOnly = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const sameDay = (a, b) =>
  a && b && dateOnly(a).getTime() === dateOnly(b).getTime();

const overlapsExceptEdges = (r, b) => {
  const start = dateOnly(r.from);
  const end = dateOnly(r.to);
  const bStart = dateOnly(b.from);
  const bEnd = dateOnly(b.to);
  const overlaps = start < bEnd && end > bStart;
  const allowedEdge = sameDay(start, bEnd) || sameDay(end, bStart);
  if (!overlaps) return false;
  if (sameDay(start, bStart) || sameDay(end, bEnd)) return true;
  return !allowedEdge;
};

const isBlockedEdge = (day, bookings) =>
  bookings.some((b) => sameDay(day, b.to)) &&
  bookings.some((b) => sameDay(day, b.from));

const API_BASE = "/api";

function BookingForm() {
  const [range, setRange] = useState({ from: undefined, to: undefined });
  const [error, setError] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const detailsRef = useRef(null);

  const [formData, setFormData] = useState({
    guest_name: "",
    guest_email: "",
    adults: "",
    grandchildren_over21: "",
    children_16plus: "",
    students: "",
    family_member: false,
  });

  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    const fetchBookings = async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("check_in, check_out, status")
        .in("status", ["pending", "approved"]);

      if (error) {
        console.error("Error loading bookings:", error);
        return;
      }

      const formatted = data.map((b) => ({
        from: new Date(b.check_in),
        to: new Date(b.check_out),
      }));

      setBookings(formatted);
    };

    fetchBookings();
  }, []);

  const handleSelect = (next) => {
    if (!next) return;

    if (next.from && (!next.to || sameDay(next.from, next.to))) {
      if (range.from && !range.to && sameDay(next.from, range.from)) {
        setRange({ from: undefined, to: undefined });
        setError("");
        return;
      }
      if (bookings.some((b) => sameDay(next.from, b.from))) {
        setError("That date is check-out only.");
        return;
      }
      if (isBlockedEdge(next.from, bookings)) {
        setError("That day is fully occupied by back-to-back bookings.");
        return;
      }
      setError("");
      setRange({ from: next.from, to: undefined });
      return;
    }

    if (next.from && next.to && !sameDay(next.from, next.to)) {
      const nights = differenceInCalendarDays(next.to, next.from);
      if (nights > 21) {
        setError("Bookings cannot be longer than 3 weeks.");
        return;
      }
      const illegal = bookings.some((b) => overlapsExceptEdges(next, b));
      if (illegal) {
        setError("That range overlaps an existing booking.");
        return;
      }
      if (isBlockedEdge(next.to, bookings)) {
        setError("Your check-out falls on a fully occupied changeover day.");
        return;
      }
      setError("");
      setRange(next);
    }
  };

  const clearDates = () => {
    setRange({ from: undefined, to: undefined });
    setError("");
    setShowDetails(false);
    setSuccess("");
  };

  const isSameDaySel = range.from && range.to && sameDay(range.from, range.to);

  const nights =
    range.from && range.to && !isSameDaySel
      ? differenceInCalendarDays(range.to, range.from)
      : 0;

  const isInvalid = Boolean(error);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFormData((prev) => {
      if (type === "checkbox") return { ...prev, [name]: checked };

      if (
        ["adults", "grandchildren_over21", "children_16plus", "students"].includes(
          name
        )
      ) {
        if (value === "" || /^\d*$/.test(value)) {
          return { ...prev, [name]: value };
        }
        return prev;
      }

      return { ...prev, [name]: value };
    });
  };

  const handleRequestBooking = () => {
    setShowDetails(true);
    setTimeout(() => {
      detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  setSuccess("");
  setError("");

  try {
    const payload = {
      check_in: format(range.from, "yyyy-MM-dd"),
      check_out: format(range.to, "yyyy-MM-dd"),
      ...formData,
      adults: Number(formData.adults || 0),
      grandchildren_over21: Number(formData.grandchildren_over21 || 0),
      children_16plus: Number(formData.children_16plus || 0),
      students: Number(formData.students || 0),
    };

    const res = await fetch(`${API_BASE}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error("Failed request");
    await res.json();

    // ✅ Success
    setSuccess("Booking request submitted successfully!");

    // ✅ Reset form and calendar (but stay in place so success is visible)
    setFormData({
      guest_name: "",
      guest_email: "",
      adults: "",
      grandchildren_over21: "",
      children_16plus: "",
      students: "",
      family_member: false,
    });
    setRange({ from: undefined, to: undefined });
  } catch (err) {
    console.error(err);
    setError("Something went wrong. Try again.");
  } finally {
    setLoading(false);
  }
};


  return (
    <section id="booking" className="max-w-3xl mx-auto w-full py-16 px-6">
      <h3 className="text-3xl font-heading text-center text-primary mb-8">
        Request a Booking
      </h3>

      <form
        onSubmit={handleSubmit}
        className="bg-white shadow-md rounded-lg p-8 space-y-6"
      >
        {/* Step 1: Calendar */}
        <div className="flex flex-col space-y-2">
          <label className="font-sans text-lg text-center">
            Select your dates:
          </label>

          {/* Legend */}
          <div className="mt-2 mb-4 flex flex-wrap justify-center gap-6 font-sans text-sm">
            <div className="flex items-center gap-2">
              <div
                className="w-5 h-5"
                style={{ backgroundColor: "var(--booked-strong)" }}
              />
              <span>Booked</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="relative w-5 h-5"
                style={{ backgroundColor: "var(--booked-soft)" }}
              >
                <div
                  className="absolute top-0 left-0 w-0 h-0"
                  style={{
                    borderTop: "10px solid var(--booked-strong)",
                    borderRight: "10px solid transparent",
                  }}
                />
              </div>
              <span>Available for check-out</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="relative w-5 h-5"
                style={{ backgroundColor: "var(--booked-soft)" }}
              >
                <div
                  className="absolute top-0 right-0 w-0 h-0"
                  style={{
                    borderTop: "10px solid var(--booked-strong)",
                    borderLeft: "10px solid transparent",
                  }}
                />
              </div>
              <span>Available for check-in</span>
            </div>
          </div>

          <div className="flex justify-center">
            <BookingCalendar
              range={range}
              onChange={handleSelect}
              bookings={bookings}
            />
          </div>

          <p className="font-sans text-md text-center mt-4">
            {range.from && range.to && !isSameDaySel ? (
              <>
                Check-in:{" "}
                <span className="font-semibold">
                  {format(range.from, "EEE dd/MM/yyyy", { locale: enGB })}
                </span>{" "}
                · Check-out:{" "}
                <span className="font-semibold">
                  {format(range.to, "EEE dd/MM/yyyy", { locale: enGB })}
                </span>
              </>
            ) : range.from ? (
              <>
                Check-in:{" "}
                <span className="font-semibold">
                  {format(range.from, "EEE dd/MM/yyyy", { locale: enGB })}
                </span>{" "}
                · Check-out:{" "}
                <span className="italic text-gray-500">Select a date</span>
              </>
            ) : (
              "No dates selected"
            )}
          </p>

          {nights > 0 && (
            <p className="font-sans text-md text-center text-gray-700">
              {nights} {nights === 1 ? "night" : "nights"}
            </p>
          )}

          {error && (
            <p
              className="text-red-600 font-sans text-sm text-center"
              role="alert"
              aria-live="polite"
            >
              {error}
            </p>
          )}
        </div>

        {!showDetails && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleRequestBooking}
              disabled={isInvalid || !range.from || !range.to || isSameDaySel}
              className={`font-sans text-lg px-6 py-3 rounded-md shadow transition ${
                isInvalid || !range.from || !range.to || isSameDaySel
                  ? "bg-gray-400 text-white cursor-not-allowed"
                  : "bg-primary text-white hover:bg-yellow-500"
              }`}
            >
              Request Booking
            </button>
          </div>
        )}

        {showDetails && (
          <div className="space-y-4" ref={detailsRef}>
            <div>
              <label className="block font-sans text-sm mb-1">Name</label>
              <input
                type="text"
                name="guest_name"
                placeholder="Your Name"
                value={formData.guest_name}
                onChange={handleChange}
                className="w-full border rounded-md px-4 py-2"
                required
              />
            </div>

            <div>
              <label className="block font-sans text-sm mb-1">Email</label>
              <input
                type="email"
                name="guest_email"
                placeholder="you@example.com"
                value={formData.guest_email}
                onChange={handleChange}
                className="w-full border rounded-md px-4 py-2"
                required
              />
            </div>

            {/* Number fields */}
            <div>
              <label className="block font-sans text-sm mb-1">
                Number of Adults
              </label>
              <input
                type="number"
                name="adults"
                min="0"
                inputMode="numeric"
                pattern="[0-9]*"
                value={formData.adults}
                onChange={handleChange}
                className="w-full border rounded-md px-4 py-2"
              />
            </div>

            <div>
              <label className="block font-sans text-sm mb-1">
                Number of Grandchildren Over 21
              </label>
              <input
                type="number"
                name="grandchildren_over21"
                min="0"
                inputMode="numeric"
                pattern="[0-9]*"
                value={formData.grandchildren_over21}
                onChange={handleChange}
                className="w-full border rounded-md px-4 py-2"
              />
            </div>

            <div>
              <label className="block font-sans text-sm mb-1">
                Number of Children aged 16+
              </label>
              <input
                type="number"
                name="children_16plus"
                min="0"
                inputMode="numeric"
                pattern="[0-9]*"
                value={formData.children_16plus}
                onChange={handleChange}
                className="w-full border rounded-md px-4 py-2"
              />
            </div>

            <div>
              <label className="block font-sans text-sm mb-1">
                Number of Students
              </label>
              <input
                type="number"
                name="students"
                min="0"
                inputMode="numeric"
                pattern="[0-9]*"
                value={formData.students}
                onChange={handleChange}
                className="w-full border rounded-md px-4 py-2"
              />
            </div>

            <div>
              <label className="block font-sans text-sm mb-1">
                Are you a family member?
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="family_member"
                  checked={formData.family_member}
                  onChange={handleChange}
                />
                Family Member
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Leave unchecked if non-family.
              </p>
            </div>

            <div className="flex justify-center">
              <button
                type="submit"
                disabled={loading}
                className="bg-primary text-white font-sans text-lg px-6 py-3 rounded-md shadow hover:bg-yellow-500 transition"
              >
                {loading ? "Submitting..." : "Submit Booking"}
              </button>
            </div>

            {success && (
              <p
                className="text-green-600 font-sans text-sm text-center"
                role="status"
                aria-live="polite"
              >
                {success}
              </p>
            )}
            {error && (
              <p
                className="text-red-600 font-sans text-sm text-center"
                role="alert"
                aria-live="polite"
              >
                {error}
              </p>
            )}
          </div>
        )}

        {range.from && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={clearDates}
              className="text-sm text-secondary underline hover:opacity-80"
            >
              Clear dates
            </button>
          </div>
        )}
      </form>
    </section>
  );
}

export default BookingForm;

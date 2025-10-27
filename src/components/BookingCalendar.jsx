import { DayPicker } from "react-day-picker"
import { addDays, isBefore } from "date-fns"
import "react-day-picker/style.css"
import "./booking-calendar.css"

// normalize to date-only (no time)
const dateOnly = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const sameDay = (a, b) =>
  a && b && dateOnly(a).getTime() === dateOnly(b).getTime()

// expand a booking [from,to) into interior days (strictly between)
const expandInteriorDays = (booking) => {
  const days = []
  let d = addDays(dateOnly(booking.from), 1)
  const end = dateOnly(booking.to)
  while (isBefore(d, end)) {
    days.push(d)
    d = addDays(d, 1)
  }
  return days
}

function BookingCalendar({ range, onChange, bookings = [] }) {
  // build modifier day sets
  const bookedMiddle = bookings.flatMap(expandInteriorDays) // fully blocked inside
  const bookedStart = bookings.map((b) => dateOnly(b.from)) // checkout-only
  const bookedEnd = bookings.map((b) => dateOnly(b.to))     // check-in-only

  // find overlap days that are both start & end (should look like middle)
  const bookedEdge = bookedStart.filter((d) =>
    bookedEnd.some((e) => sameDay(d, e))
  )

  return (
    <DayPicker
      mode="range"
      selected={range}
      onSelect={onChange}
      numberOfMonths={1}
      showOutsideDays
      // prevent clicking fully blocked days
      disabled={(day) =>
        bookedMiddle.some((d) => sameDay(d, day)) ||
        bookedEdge.some((d) => sameDay(d, day))
      }
      // expose sets for styling
      modifiers={{
        bookedMiddle,
        bookedStart,
        bookedEnd,
        bookedEdge,
      }}
      modifiersClassNames={{
        bookedMiddle: "bookedMiddle",
        bookedStart: "bookedStart",
        bookedEnd: "bookedEnd",
        bookedEdge: "bookedEdge",
      }}
    />
  )
}

export default BookingCalendar

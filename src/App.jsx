import Navbar from "./components/Navbar"
import Hero from "./components/Hero"
import BookingForm from "./components/BookingForm"

function App() {
  return (
    <div className="min-h-screen flex flex-col bg-neutralbg text-text">
      <Navbar />
      <Hero />
      <BookingForm />
    </div>
  )
}

export default App

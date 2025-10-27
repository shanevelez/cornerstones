function Hero() {
  return (
    <main
      className="flex flex-col items-center justify-center text-center px-6 bg-cover bg-center min-h-[70vh]"
      style={{ backgroundImage: "url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e')" }}
    >
      <div className="bg-white/70 p-8 rounded-lg shadow-md">
        <h2 className="text-5xl font-heading text-primary mb-4">
          Welcome to Cornerstones
        </h2>
        <p className="text-xl font-sans text-text max-w-xl mb-8">
          Our family holiday home for generations
        </p>
        <a
          href="#booking"
          className="bg-primary text-white font-sans text-lg px-6 py-3 rounded-full shadow-md hover:bg-yellow-500 transition"
        >
          Book Now
        </a>
      </div>
    </main>
  )
}

export default Hero

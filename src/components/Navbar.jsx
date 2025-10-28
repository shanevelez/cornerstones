function Navbar() {
  return (
    <header className="w-full bg-white shadow-sm">
      <nav className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between py-4 px-6 text-center sm:text-left">
        {/* Title */}
        <h1 className="font-heading text-2xl text-primary mb-3 sm:mb-0">
          Cornerstones
        </h1>

        {/* Nav links */}
        <div className="font-sans text-lg flex justify-center gap-6 sm:gap-8">
          <a
            href="https://www.cornerstonescrantock.com"
            className="hover:text-primary transition-colors"
          >
            Book
          </a>
          <a
            href="/local-recs"
            className="hover:text-primary transition-colors"
          >
            Local Recs
          </a>
        </div>
      </nav>
    </header>
  );
}

export default Navbar;

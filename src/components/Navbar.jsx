function Navbar() {
  return (
    <header className="w-full bg-white shadow-sm">
      <nav className="max-w-5xl mx-auto flex items-center justify-between py-4 px-6">
        {/* Left: title */}
        <h1 className="font-heading text-2xl text-primary">Cornerstones</h1>

        {/* Right: nav links */}
        <div className="space-x-6 font-sans text-lg">
          <a href="https://www.cornerstonescrantock.com" className="hover:text-primary">Book</a>
          <a href="/local-recs" className="hover:text-primary">
            Local Recs
          </a>
          
        </div>
      </nav>
    </header>
  );
}

export default Navbar;

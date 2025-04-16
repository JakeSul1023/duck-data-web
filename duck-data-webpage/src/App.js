import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Home from "./pages/home.js";           
import AboutUs from "./pages/aboutus";       
import LearnMore from "./pages/learnmore";

function App() {
  return (
    <Router>
      <div>
        {/* Navigation */}
        <nav style={{ padding: "5px", background: "#f0f0f0" }}>
          <Link to="/" style={{ marginRight: "15px" }}>Home</Link>
          <Link to="/about" style={{ marginRight: "15px" }}>About Us</Link>
          <Link to="/learnmore">Learn More</Link>
        </nav>

        {/* Routes for the page defined */}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<AboutUs />} />
          <Route path="/learnmore" element={<LearnMore />} />
          {/* catch-all route for 404 */}
          <Route path="*" element={<h2>404 - Not Found</h2>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
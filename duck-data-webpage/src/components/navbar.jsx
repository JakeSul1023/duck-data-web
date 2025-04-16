import React from "react";
import { Link } from "react-router-dom";

export default function NavBar() {
  return (
    <nav style={{ padding: "10px", background: "#fff" }}>
      <Link to="/" style={{ marginRight: "15px" }}>Home</Link>
      <Link to="/about" style={{ marginRight: "15px" }}>About Us</Link>
      <Link to="/learnmore">Learn More</Link>
    </nav>
  );
}

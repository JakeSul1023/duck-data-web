// duck-data-webpage/src/App.js
import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import NavBar from './components/navbar'; // Correct path
import Home from './pages/home'; // Example page
import AboutUs from './pages/aboutus'; // Example page
import LearnMore from './pages/learnmore'; // Example page
import './App.css'; // Main CSS

function App() {
  return (
    <Router>
      <div className="App"> {/* This div gets the padding-left */}
        <NavBar /> {/* Sidebar/Hamburger */}
        <main className="content"> {/* Content area */}
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<AboutUs />} />
            <Route path="/learnmore" element={<LearnMore />} />
            {/* Add other routes here */}
          </Routes>
        </main>
        <footer> {/* Footer inside .App */}
           <p>© {new Date().getFullYear()} Duck Migration Tracker</p>
        </footer>
      </div>
    </Router>
  );
}

export default App;

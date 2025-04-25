// duck-data-webpage/src/App.js
import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import NavBar from './components/navbar'; 
import Home from './pages/home'; 
import AboutUs from './pages/aboutus'; 
import LearnMore from './pages/learnmore'; 
import './App.css'; // Main CSS
import Newsletter from './pages/newsletter';

function App() {
  return (
    <Router basename="/duck-data-web"> {/* Set the base URL for routing */}
      <div className="App"> {/* This div gets the padding-left */}
        <NavBar /> {/* Sidebar/Hamburger */}
        <main className="content"> {/* Content area */}
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<AboutUs />} />
            <Route path="/learnmore" element={<LearnMore />} />
            <Route path="/newsletter" element={<Newsletter />} />
            {/* Add other routes here */}
          </Routes>
        </main>
        <footer> {/* Footer inside .App */}
           <p>© {new Date().getFullYear()} Mallard Migration Prediction</p>
        </footer>
      </div>
    </Router>
  );
}

export default App;

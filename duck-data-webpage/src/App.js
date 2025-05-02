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
    <Router> 
      <div className="App"> 
        <NavBar /> 
        <main className="content"> 
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<AboutUs />} />
            <Route path="/learnmore" element={<LearnMore />} />
            <Route path="/newsletter" element={<Newsletter />} />
           
          </Routes>
        </main>
        <footer> 
           <p>© {new Date().getFullYear()} Mallard Migration Prediction</p>
        </footer>
      </div>
    </Router>
  );
}

export default App;

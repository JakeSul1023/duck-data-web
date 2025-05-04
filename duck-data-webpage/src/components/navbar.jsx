import React, { useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
 
// --- Constants ---
const navbarHeight = "60px";
const mobileBreakpoint = "768px";
 
// --- Styled Components ---
 
// Main Navigation Container (Top Bar)
const Nav = styled.nav`
  background-color:rgb(38, 72, 4); /* Darker Forest Green */
  color: #fff; /* White text */
  height: ${navbarHeight};
  width: 100%;
  position: fixed; /* Fixed at the top */
  top: 0;
  left: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: space-between; /* Space between logo/title and links */
  padding: 0 2rem; /* Horizontal padding */
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.25);
  font-family: 'Lato', sans-serif;
`;
 
const LogoTitle = styled(Link)` // Make it a link to home
  color: #fff;
  font-size: 1.5em;
  font-weight: 600; /* Slightly bolder */
  text-decoration: none;
  margin-right: auto; // Pushes links to the right
  font-family: 'Lato', sans-serif;
  letter-spacing: 0.5px; /* Add subtle letter spacing */
 
  @media (max-width: ${mobileBreakpoint}) {
     position: absolute;
     left: 15px;
     top: 50%;
     transform: translateY(-50%);
  }
`;
 
 
// Links Container (adjust for horizontal layout and mobile dropdown)
const LinksContainer = styled.div`
  display: flex; // Horizontal layout for links
  align-items: center;
  font-family: 'Lato', sans-serif;
 
  @media (max-width: ${mobileBreakpoint}) {
    display: ${props => (props.isOpen ? 'flex' : 'none')}; // Control visibility
    flex-direction: column; // Stack links vertically on mobile
    position: absolute;
    top: ${navbarHeight}; // Position below navbar
    left: 0;
    width: 100%;
    background-color: #336600; /* Darker Forest Green */
    padding: 1rem 0; // Add padding for dropdown
    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.15); // Shadow for dropdown
    border-top: 1px solid rgba(255, 255, 255, 0.1); // Separator line - white
  }
`;
 
// Navigation Links
const StyledLink = styled(Link)`
  color: #fff; /* White text */
  text-decoration: none;
  font-weight: 500;
  font-size: 1.1rem; /* Slightly larger font */
  transition: background-color 0.2s ease-in-out, color 0.2s ease-in-out;
  padding: 0.5rem 1rem; // Adjust padding for horizontal layout
  border-radius: 4px;
  margin: 0 0.5rem; // Horizontal margin between links
  display: inline-block; // Display links side-by-side
  font-family: 'Lato', sans-serif;
 
  &:hover {
    background-color: rgba(255, 255, 255, 0.2); /* Softer white hover */
    color: #fff;
  }
 
  @media (max-width: ${mobileBreakpoint}) {
    display: block; // Stack links in mobile dropdown
    width: 90%; // Make links take most of the dropdown width
    margin: 0.5rem auto; // Center links vertically
    text-align: center; // Center text
    padding: 0.8rem 1rem; // Adjust padding for vertical stacking
  }
 
  /* &.active { ... } */ // Optional active styling
`;
 
 
// Hamburger Icon (Position adjusted for top right)
const MenuIcon = styled.button`
  display: none;
  background: none;
  border: none;
  padding: 10px;
  cursor: pointer;
  z-index: 1100;
 
  span {
    display: block;
    width: 25px;
    height: 3px;
    background-color: #fff;
    margin: 5px 0;
    transition: background-color 0.3s ease;
  }
 
  /* 👇 mobile overrides */
  @media (max-width: ${mobileBreakpoint}) {
    display: block;
    margin-left: auto;   /* 🆕 pushes icon all the way to the right */
  }
`;
 
 
// --- Component ---
const NavBar = () => {
  const [isOpen, setIsOpen] = useState(false);
 
  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => setIsOpen(false);
 
  return (
    <Nav>
      <LogoTitle to="/" onClick={closeMenu}>moveduck.</LogoTitle> {/* Added Logo/Title */}
      <MenuIcon onClick={toggleMenu} aria-label="Toggle menu">
        <span />
        <span />
        <span />
      </MenuIcon>
      <LinksContainer isOpen={isOpen}>
        <StyledLink to="/" onClick={closeMenu}>Home</StyledLink>
        <StyledLink to="/about" onClick={closeMenu}>About Us</StyledLink>
        <StyledLink to="/learnmore" onClick={closeMenu}>Learn More</StyledLink>
        <StyledLink to="/newsletter" onClick={closeMenu}>Newsletter</StyledLink>

 
      </LinksContainer>
    </Nav>
  );
};
 
export default NavBar;
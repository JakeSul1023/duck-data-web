import React, { useState, useEffect } from "react";
import "../App.css";

export default function Newsletter() {
  const [formData, setFormData] = useState({
    emailOrPhone: "",
    zip: "",
  });
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);

  // Load SweetAlert2 dynamically
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/sweetalert2@11";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const validateForm = () => {
    const newErrors = {};

    // Email or Phone validation
    const emailOrPhone = formData.emailOrPhone.trim();
    if (!emailOrPhone) {
      newErrors.emailOrPhone = "Email or phone number is required";
    } else if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailOrPhone) && // Not a valid email
      !/^\d{10}$/.test(emailOrPhone.replace(/\D/g, "")) // Not a 10-digit phone number
    ) {
      newErrors.emailOrPhone = "Please enter a valid email address or 10-digit phone number";
    }

    // Zip validation
    const zip = formData.zip.replace(/\D/g, "");
    if (!zip) {
      newErrors.zip = "Zip code is required";
    } else if (!/^\d{5}$/.test(zip)) {
      newErrors.zip = "Please enter a valid 5-digit zip code";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      setSubmitted(true);
      // Show SweetAlert2 popup
      window.Swal.fire({
        title: "Thanks for signing up for our newsletter!",
        icon: "success",
        confirmButtonText: "OK",
      }).then(() => {
        setFormData({ emailOrPhone: "", zip: "" }); // Clear form
        setSubmitted(false); // Reset submitted state
      });
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  return (
    <div className="home-container">
      <section className="nws-info-bar">
        <div className="nws-info-content">
          <h2>Join our Newsletter</h2>
        </div>
      </section>

      <div className="home-header">
        <h1>Subscribe to Duck Migration today and stay informed about project and Migration updates.</h1>
      </div>

      <section className="key-map-section">
        <div className="key-map-content">
          <h3>Newsletter Signup</h3>
          {submitted ? null : (
            <form onSubmit={handleSubmit} className="newsletter-form">
              <div className="form-field">
                <label htmlFor="emailOrPhone">Email or Phone</label>
                <input
                  type="text"
                  id="emailOrPhone"
                  name="emailOrPhone"
                  value={formData.emailOrPhone}
                  onChange={handleChange}
                  className={errors.emailOrPhone ? "input-error" : ""}
                  placeholder="Enter your email or 10-digit phone"
                />
                {errors.emailOrPhone && <p className="error-message">{errors.emailOrPhone}</p>}
              </div>

              <div className="form-field">
                <label htmlFor="zip">Zip</label>
                <input
                  type="text"
                  id="zip"
                  name="zip"
                  value={formData.zip}
                  onChange={handleChange}
                  className={errors.zip ? "input-error" : ""}
                  placeholder="Enter 5-digit zip"
                />
                {errors.zip && (
                  <p className="error-message">{errors.zip}</p>
                )}
              </div>

              <button type="submit" className="submit-button">
                Subscribe
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
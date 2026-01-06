// src/pages/LandingPage.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

function LandingPage() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("top");

  // Handle scroll events for navbar styling and active section detection
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }

      const sections = ["top", "about", "features", "workflow", "testimonials", "faq"];
      const scrollPosition = window.scrollY + 100;

      for (const section of sections) {
        const element = document.getElementById(section);
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (
            scrollPosition >= offsetTop &&
            scrollPosition < offsetTop + offsetHeight
          ) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function handleTryItClick() {
    navigate("/login");
  }

  function scrollToSection(sectionId) {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  }

  return (
    <div className="landing-page">
      {/* Top Nav with dynamic styling based on scroll */}
      <header className={`landing-nav ${scrolled ? "scrolled" : ""}`}>
        <div className="logo">
          <img 
            src="assets/logo.png"
            className="logo-img"
          />
          
        </div>
        <nav className="landing-nav-links">
          <a
            href="#about"
            className={activeSection === "about" ? "active" : ""}
            onClick={(e) => {
              e.preventDefault();
              scrollToSection("about");
            }}
          >
            About
          </a>
          <a
            href="#features"
            className={activeSection === "features" ? "active" : ""}
            onClick={(e) => {
              e.preventDefault();
              scrollToSection("features");
            }}
          >
            Features
          </a>
          <a
            href="#workflow"
            className={activeSection === "workflow" ? "active" : ""}
            onClick={(e) => {
              e.preventDefault();
              scrollToSection("workflow");
            }}
          >
            How it works
          </a>
          <a
            href="#testimonials"
            className={activeSection === "testimonials" ? "active" : ""}
            onClick={(e) => {
              e.preventDefault();
              scrollToSection("testimonials");
            }}
          >
            Stories
          </a>
          <a
            href="#faq"
            className={activeSection === "faq" ? "active" : ""}
            onClick={(e) => {
              e.preventDefault();
              scrollToSection("faq");
            }}
          >
            FAQ
          </a>
          <button
            className="btn secondary small"
            onClick={() => navigate("/login")}
          >
            Login
          </button>
        </nav>
      </header>

      {/* Hero section with updated copy for new audience */}
      <section className="hero-section" id="top">
        <div className="hero-content">
          <div className="hero-text">
            <h1>Your AI-Powered Second Opinion for Bone Injuries</h1>
            <p>
              Whether you're anxiously waiting for a diagnosis or learning to read X-rays, FractoScan provides instant, preliminary analyses. Get clarity on potential fractures and build your diagnostic confidence.
            </p>
            <div className="hero-buttons">
              <button className="btn primary" onClick={handleTryItClick}>
                Analyze Your X-Ray
              </button>
              <a href="#features" className="text-link">
                Learn more ↓
              </a>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-panel">
              <div className="hero-card">
                <p className="hero-label">Sample Analysis</p>
                <div className="hero-image">
                  <div className="xray-container">
                    <div className="xray-image"></div>
                    <div className="fracture-indicator"></div>
                  </div>
                </div>
                <p className="hero-prediction">Prediction: Fractured</p>
                <p className="hero-confidence">Confidence: 94%</p>
                <p className="hero-note">
                  *This is a preliminary tool and not a substitute for a professional medical diagnosis.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About section with updated copy */}
      <section id="about" className="info-section">
        <div className="section-content">
          <h2>What is FractoScan?</h2>
          <p>
            FractoScan is an accessible web tool designed for both individuals with potential bone injuries and medical trainees. Using advanced AI, it analyzes your X-ray images to identify possible fractures, providing a quick preliminary result to help you understand what might be going on.
          </p>
          <div className="about-visual">
            <div className="comparison-container">
              <div className="comparison-item">
                <div className="comparison-image normal"></div>
                <h4>Normal Bone</h4>
              </div>
              <div className="comparison-arrow">→</div>
              <div className="comparison-item">
                <div className="comparison-image fractured"></div>
                <h4>Potential Fracture</h4>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features section updated for new users */}
      <section id="features" className="info-section features-section">
        <div className="section-content">
          <h2>Key Features</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🧑‍⚕️</div>
              <h3>For Patients: Peace of Mind</h3>
              <p>
                Get a fast, preliminary analysis while you wait for your appointment. Understand the urgency of your situation.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🎓</div>
              <h3>For Trainees: Build Skills</h3>
              <p>
                Practice identifying fractures and compare your assessment with the AI's prediction to improve your diagnostic skills.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Clear Confidence Scores</h3>
              <p>
                See how certain the AI is about its prediction, helping you weigh the preliminary result appropriately.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔒</div>
              <h3>Private & Secure</h3>
              <p>
                Your images and data are encrypted and processed securely. We prioritize your privacy above all else.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">💻</div>
              <h3>Simple & Accessible</h3>
              <p>
                No complex software needed. Access FractoScan from any browser, on your phone or computer.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>Instant Results</h3>
              <p>
                Upload your X-ray and receive a detailed analysis in seconds, not hours or days.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Workflow section simplified for the user */}
      <section id="workflow" className="info-section workflow-section">
        <div className="section-content">
          <h2>How it works</h2>
          <div className="workflow-container">
            <div className="workflow-steps">
              <div className="workflow-step">
                <div className="step-number">1</div>
                <div className="step-content">
                  <h3>Create Account</h3>
                  <p>Sign up for a secure account to protect your information.</p>
                </div>
              </div>
              <div className="workflow-step">
                <div className="step-number">2</div>
                <div className="step-content">
                  <h3>Upload X-Ray</h3>
                  <p>Upload a clear image of your bone X-ray directly from your device.</p>
                </div>
              </div>
              <div className="workflow-step">
                <div className="step-number">3</div>
                <div className="step-content">
                  <h3>AI Analysis</h3>
                  <p>Our AI model scans the image for patterns indicative of a fracture.</p>
                </div>
              </div>
              <div className="workflow-step">
                <div className="step-number">4</div>
                <div className="step-content">
                  <h3>View Results</h3>
                  <p>Instantly receive your preliminary result with a confidence score.</p>
                </div>
              </div>
            </div>
            <div className="workflow-visual">
              <div className="workflow-diagram">
                <div className="workflow-node login"></div>
                <div className="workflow-arrow"></div>
                <div className="workflow-node upload"></div>
                <div className="workflow-arrow"></div>
                <div className="workflow-node analyze"></div>
                <div className="workflow-arrow"></div>
                <div className="workflow-node results"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials section updated for new audience */}
      <section id="testimonials" className="testimonials-section">
        <div className="section-content">
          <h2>Hear From Our Users</h2>
          <div className="testimonials-grid">
            <div className="testimonial-card">
              <div className="testimonial-content">
                <p>
                  "I hurt my wrist over the weekend and was panicking. FractoScan gave me a preliminary result that helped me calm down until I could see my doctor on Monday. It was a huge relief."
                </p>
              </div>
              <div className="testimonial-author">
                <div className="author-avatar">A</div>
                <div className="author-info">
                  <h4>Alex M.</h4>
                  <p>Patient</p>
                </div>
              </div>
            </div>
            <div className="testimonial-card">
              <div className="testimonial-content">
                <p>
                  "As a med student, I'm always looking for ways to practice. I use FractoScan to quiz myself on X-rays before looking at the official report. It's been an amazing study companion."
                </p>
              </div>
              <div className="testimonial-author">
                <div className="author-avatar">J</div>
                <div className="author-info">
                  <h4>Jordan T.</h4>
                  <p>Medical Student</p>
                </div>
              </div>
            </div>
            <div className="testimonial-card">
              <div className="testimonial-content">
                <p>
                  "The interface is so simple, even for someone not tech-savvy like me. I uploaded my son's arm X-ray and got the results in less than a minute. It made the trip to the ER less stressful."
                </p>
              </div>
              <div className="testimonial-author">
                <div className="author-avatar">M</div>
                <div className="author-info">
                  <h4>Maria S.</h4>
                  <p>Parent</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ section updated with relevant questions */}
      <section id="faq" className="faq-section">
        <div className="section-content">
          <h2>Frequently Asked Questions</h2>
          <div className="faq-list">
            <div className="faq-item">
              <h3>Is this a substitute for a doctor's diagnosis?</h3>
              <p>
                <strong>Absolutely not.</strong> FractoScan is a preliminary tool designed to provide insight and support. It is not a replacement for a qualified medical professional's diagnosis. Always consult a doctor for any medical concerns.
              </p>
            </div>
            <div className="faq-item">
              <h3>How accurate is FractoScan?</h3>
              <p>
                Our model has a high accuracy rate on our test dataset, but no AI is perfect. The confidence score provided helps indicate the reliability of the prediction. It should be used as a guide, not a final answer.
              </p>
            </div>
            <div className="faq-item">
              <h3>Is my health information secure and private?</h3>
              <p>
                Yes. We take privacy very seriously. All images and data are encrypted and processed securely. We do not share your personal health information with any third parties.
              </p>
            </div>
            <div className="faq-item">
              <h3>What type of X-rays can I upload?</h3>
              <p>
                FractoScan is currently trained to analyze standard X-ray images of common bones like arms, legs, hands, and feet. For best results, ensure the image is clear and well-lit.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA section */}
      <section className="cta-section">
        <div className="section-content">
          <h2>Get Clarity on Your X-Ray Today</h2>
          <p>Join thousands of users getting preliminary insights in seconds.</p>
          <div className="cta-buttons">
            <button className="btn primary big" onClick={handleTryItClick}>
              Get Started
            </button>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-section">
            <h3>FractoScan</h3>
            <p>Your AI-powered companion for preliminary X-ray analysis.</p>
            <div className="social-links">
              <a href="#" className="social-link">LinkedIn</a>
              <a href="#" className="social-link">Twitter</a>
              <a href="#" className="social-link">Research</a>
            </div>
          </div>
          <div className="footer-section">
            <h3>Product</h3>
            <ul>
              <li><a href="#features">Features</a></li>
              <li><a href="#workflow">How it works</a></li>
              <li><a href="#testimonials">Stories</a></li>
              <li><a href="#faq">FAQ</a></li>
            </ul>
          </div>
          <div className="footer-section">
            <h3>Company</h3>
            <ul>
              <li><a href="#">About us</a></li>
              <li><a href="#">Careers</a></li>
              <li><a href="#">Contact</a></li>
              <li><a href="#">Privacy Policy</a></li>
            </ul>
          </div>
          <div className="footer-section">
            <h3>Resources</h3>
            <ul>
              <li><a href="#">Documentation</a></li>
              <li><a href="#">Research Papers</a></li>
              <li><a href="#">Blog</a></li>
              <li><a href="#">Support</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <small>© 2023 FractoScan. All rights reserved. | Not a substitute for professional medical advice.</small>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
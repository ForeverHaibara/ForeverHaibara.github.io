import React from 'react';
import { Link } from 'react-router-dom';
import KatexDisplay from '../components/KatexDisplay';
import { Arrow, GeometrySketch, usePageEntrance } from '../components/PageVisuals';
import '../styles/showcase.css';

const HomePage: React.FC = () => {
  usePageEntrance();
  return (
    <div className="showcase-page home-page">
      <section className="home-intro" aria-labelledby="home-title">
        <div className="home-intro-copy">
          <p className="eyebrow">
            <span className="eyebrow-line" /> FOREVERHAIBARA / PERSONAL SPACE
          </p>
          <h1 id="home-title">
            Mathematics.
            <br />
            Code.
            <br />
            <span>A little curiosity.</span>
          </h1>
          <p className="intro-description">
            Hello, I'm ForeverHaibara. Welcome to my corner of the web — a collection of tools,
            experiments, and notes in mathematics and code.
          </p>
          <div className="page-actions">
            <button
              className="design-button design-button--primary"
              type="button"
              onClick={() =>
                document
                  .getElementById('projects')
                  ?.scrollIntoView({
                    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                      ? 'instant'
                      : 'smooth',
                  })
              }
            >
              Explore the projects <Arrow />
            </button>
            <Link className="design-text-link" to="/about">
              A little about me <Arrow />
            </Link>
          </div>
        </div>
        <div className="home-visual">
          <div className="visual-topline">
            <span>AN EXPLORATION IN MATHEMATICS</span>
            <span>01 / ∞</span>
          </div>
          <GeometrySketch />
          <div className="visual-caption">
            <span className="visual-cross">+</span>
            <p>
              A different perspective.
              <br />
              <strong>A new way to see the problem.</strong>
            </p>
          </div>
          <span className="visual-orbit" aria-hidden="true" />
        </div>
      </section>
      <section id="projects" className="home-projects" aria-labelledby="projects-title">
        <div className="design-section-heading">
          <div>
            <p className="eyebrow">TOOLS & EXPLORATIONS</p>
            <h2 id="projects-title">From ideas to something useful.</h2>
          </div>
          <span className="section-side-note">Built to explore. Open to everyone.</span>
        </div>
        <div className="featured-projects">
          <Link to="/triples" className="project-feature project-feature--triples">
            <div className="project-topline">
              <span className="project-symbol" aria-hidden="true">
                ∑
              </span>
              <span className="design-tag">ALGEBRA · PYTHON</span>
              <span className="project-arrow">
                <Arrow diagonal />
              </span>
            </div>
            <div className="project-copy">
              <h3>Triples Inequality Solver</h3>
              <p>
                From an inequality to a proof. Explore algebraic inequalities through sum-of-squares
                decompositions.
              </p>
            </div>
            <div className="project-equation" aria-hidden="true">
              <KatexDisplay latex={'a^2+b^2+c^2-ab-bc-ca\\;\\geq\\;0'} />
              <span>Every inequality has a story.</span>
            </div>
            <span className="project-cta">
              Try the solver <Arrow />
            </span>
          </Link>
          <Link to="/geogebra" className="project-feature project-feature--geometry">
            <div className="project-topline">
              <span className="project-symbol project-symbol--geometry" aria-hidden="true">
                △
              </span>
              <span className="design-tag">GEOMETRY · INTERACTIVE</span>
              <span className="project-arrow">
                <Arrow diagonal />
              </span>
            </div>
            <div className="project-copy">
              <h3>GeoGebra Studio</h3>
              <p>
                Construct, investigate, and connect the dots. A workspace for geometry and
                programmable exploration.
              </p>
            </div>
            <div className="project-mini-sketch">
              <GeometrySketch />
            </div>
            <span className="project-cta">
              Open the studio <Arrow />
            </span>
          </Link>
        </div>
        <div className="project-directory">
          <Link to="/geometry" className="directory-link">
            <span className="directory-number">01</span>
            <div>
              <h3>Geometry Archive</h3>
              <p>Find a problem. Follow an idea. Search the pure geometry Tieba archive.</p>
            </div>
            <Arrow />
          </Link>
          <Link to="/blog" className="directory-link">
            <span className="directory-number">02</span>
            <div>
              <h3>Notes & writing</h3>
              <p>Thoughts and discoveries along the way, collected in the blog.</p>
            </div>
            <Arrow />
          </Link>
        </div>
      </section>
      <div className="home-colophon">
        <span>A small space for ongoing exploration.</span>
        <a
          className="design-text-link"
          href="https://github.com/ForeverHaibara/ForeverHaibara.github.io"
          target="_blank"
          rel="noopener noreferrer"
        >
          View this site on GitHub <Arrow diagonal />
        </a>
      </div>
    </div>
  );
};

export default HomePage;

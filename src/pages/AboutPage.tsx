import React from 'react';
import { Link } from 'react-router-dom';
import { Arrow, usePageEntrance } from '../components/PageVisuals';
import '../styles/showcase.css';

const AboutPage: React.FC = () => {
  usePageEntrance();
  return (
    <div className="showcase-page about-page">
      <header className="about-heading">
        <p className="eyebrow">
          <span className="eyebrow-line" /> BEHIND THE PROJECTS
        </p>
        <h1>
          A little about <span>me.</span>
        </h1>
        <p>Mathematics, code, and the ideas that connect them.</p>
      </header>
      <div className="about-grid">
        <aside className="profile-card" aria-label="Profile">
          <div className="profile-monogram" aria-hidden="true">
            F<span>h.</span>
            <i />
          </div>
          <p className="eyebrow">HELLO, I'M</p>
          <h2>ForeverHaibara</h2>
          <p className="profile-description">
            Exploring mathematics
            <br />
            through code.
          </p>
          <div className="profile-tags">
            <span>Algebra</span>
            <span>Geometry</span>
            <span>Open source</span>
          </div>
          <a
            className="profile-github"
            href="https://github.com/ForeverHaibara"
            target="_blank"
            rel="noopener noreferrer"
          >
            Find me on GitHub <Arrow diagonal />
          </a>
        </aside>
        <div className="about-story">
          <section className="about-note">
            <span className="section-index">01 / WELCOME</span>
            <h2>
              A space to think,
              <br />
              build, and explore.
            </h2>
            <p>
              This site brings together my mathematical tools, experiments, and writing. You can
              work through an inequality, explore a geometric construction, or browse the notes
              behind the code.
            </p>
            <p className="about-credit">Hello! This site was redesigned with ChatGPT and Codex.</p>
          </section>
          <section className="about-interests">
            <div className="design-section-heading">
              <h2>What you'll find here</h2>
              <span className="section-index">02 / EXPLORE</span>
            </div>
            <Link to="/triples">
              <span className="interest-mark" aria-hidden="true">
                ∑
              </span>
              <div>
                <h3>Algebra, made tangible.</h3>
                <p>Inequalities and sum-of-squares proofs with Triples.</p>
              </div>
              <Arrow />
            </Link>
            <Link to="/geogebra">
              <span className="interest-mark" aria-hidden="true">
                △
              </span>
              <div>
                <h3>Geometry, in motion.</h3>
                <p>Constructions and exploration in GeoGebra Studio.</p>
              </div>
              <Arrow />
            </Link>
            <Link to="/blog">
              <span className="interest-mark" aria-hidden="true">
                ↗
              </span>
              <div>
                <h3>Ideas, written down.</h3>
                <p>Notes on mathematics and programming.</p>
              </div>
              <Arrow />
            </Link>
          </section>
        </div>
      </div>
      <section className="about-philosophy">
        <div>
          <p className="eyebrow">A PERSONAL PHILOSOPHY</p>
          <span className="philosophy-caption">A short thought, in its original form.</span>
        </div>
        <blockquote>
          “ChatGPT is better.”<span aria-hidden="true">”</span>
        </blockquote>
      </section>
    </div>
  );
};

export default AboutPage;

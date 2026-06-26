import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Apple,
  BadgeCheck,
  BookOpen,
  Cable,
  CircleCheck,
  Download,
  ExternalLink,
  FileText,
  Gauge,
  Github,
  Headphones,
  Keyboard,
  Laptop,
  Layers,
  Library,
  MonitorPlay,
  Music2,
  Piano,
  Route,
  Settings2,
  Split,
  Workflow,
} from "lucide-react";
import {
  getSiteContent,
  localeOptions,
  releasesUrl,
  repoUrl,
  resolveLocale,
  type IconKey,
  type Locale,
} from "./content";

const asset = (filename: string): string =>
  `${import.meta.env.BASE_URL}assets/${filename}`;

const iconMap = {
  activity: Activity,
  apple: Apple,
  badgeCheck: BadgeCheck,
  bookOpen: BookOpen,
  cable: Cable,
  circleCheck: CircleCheck,
  download: Download,
  fileText: FileText,
  gauge: Gauge,
  headphones: Headphones,
  keyboard: Keyboard,
  laptop: Laptop,
  layers: Layers,
  library: Library,
  monitorPlay: MonitorPlay,
  music: Music2,
  piano: Piano,
  route: Route,
  settings: Settings2,
  split: Split,
  workflow: Workflow,
} satisfies Record<IconKey, LucideIcon>;

function getInitialLocale(): Locale {
  if (typeof navigator === "undefined") {
    return "en";
  }

  return resolveLocale(navigator.language);
}

export function App(): React.JSX.Element {
  const [locale, setLocale] = useState<Locale>(getInitialLocale);
  const content = getSiteContent(locale);
  const [selectedScreenshotId, setSelectedScreenshotId] = useState(
    content.screenshots.items[0].id,
  );
  const [selectedPlatformId, setSelectedPlatformId] = useState(
    content.platforms.items[0].id,
  );

  useEffect(() => {
    document.documentElement.lang = content.meta.htmlLang;
    document.title = content.meta.title;

    const description = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    if (description) {
      description.content = content.meta.description;
    }
  }, [content]);

  const navLinks = [
    { label: content.nav.features, href: "#features" },
    { label: content.nav.screenshots, href: "#screenshots" },
    { label: content.nav.start, href: "#start" },
    { label: content.nav.docs, href: "#docs" },
  ];

  const selectedScreenshot =
    content.screenshots.items.find(
      (screenshot) => screenshot.id === selectedScreenshotId,
    ) ?? content.screenshots.items[0];
  const selectedPlatform =
    content.platforms.items.find(
      (platform) => platform.id === selectedPlatformId,
    ) ?? content.platforms.items[0];
  const SelectedPlatformIcon = iconMap[selectedPlatform.icon];

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Rexiano home">
          <img src={asset("Rexiano_icon.png")} alt="" />
          <span>Rexiano</span>
        </a>
        <nav aria-label="Primary navigation">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          <div
            className="language-switcher"
            role="group"
            aria-label={content.meta.languageToggleLabel}
          >
            {localeOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={locale === option.id}
                lang={option.htmlLang}
                onClick={() => setLocale(option.id)}
              >
                {option.shortLabel}
              </button>
            ))}
          </div>
          <a className="header-link" href={repoUrl}>
            <Github aria-hidden="true" size={18} />
            <span>{content.nav.github}</span>
          </a>
        </div>
      </header>

      <main id="top">
        <section className="hero section-band">
          <div className="section-inner hero-grid">
            <div className="hero-copy">
              <h1>Rexiano</h1>
              <p className="hero-lead">{content.hero.lead}</p>
              <div className="hero-actions" aria-label="Primary actions">
                <a className="button button-primary" href={releasesUrl}>
                  <Download aria-hidden="true" size={20} />
                  {content.hero.actions.download}
                </a>
                <a
                  className="button button-secondary"
                  href={content.hero.guideHref}
                >
                  <BookOpen aria-hidden="true" size={20} />
                  {content.hero.actions.guide}
                </a>
                <a className="button button-ghost" href={repoUrl}>
                  <Github aria-hidden="true" size={20} />
                  {content.hero.actions.github}
                </a>
              </div>
              <div className="hero-facts" aria-label="Project facts">
                {content.hero.facts.map((fact) => (
                  <span key={fact}>{fact}</span>
                ))}
              </div>
              <p className="hero-note">{content.hero.note}</p>
            </div>

            <div className="hero-media" aria-label="Rexiano app screenshots">
              <div className="note-rail" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <figure className="screenshot-frame hero-frame">
                <img
                  src={asset("rexiano-split-sheet.png")}
                  alt={content.screenshots.items[2].alt}
                />
              </figure>
              <figure className="screenshot-frame mini-frame mini-frame-left">
                <img
                  src={asset("rexiano-library.png")}
                  alt={content.screenshots.items[1].alt}
                />
              </figure>
              <figure className="screenshot-frame mini-frame mini-frame-right">
                <img
                  src={asset("rexiano-practice.png")}
                  alt={content.screenshots.items[0].alt}
                />
              </figure>
            </div>
          </div>
        </section>

        <section className="flow-section section-band" aria-labelledby="flow">
          <div className="section-inner">
            <div className="section-heading">
              <p className="section-label">{content.flow.label}</p>
              <h2 id="flow">{content.flow.heading}</h2>
            </div>
            <div className="flow-grid">
              {content.flow.items.map((step) => {
                const Icon = iconMap[step.icon];

                return (
                  <article className="flow-step" key={step.label}>
                    <div className="flow-index">
                      <span>{step.label}</span>
                      <Icon aria-hidden="true" size={24} />
                    </div>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section
          className="feature-tour section-band"
          id="features"
          aria-labelledby="features-heading"
        >
          <div className="section-inner">
            <div className="section-heading section-heading-wide">
              <p className="section-label">{content.features.label}</p>
              <h2 id="features-heading">{content.features.heading}</h2>
              <p>{content.features.description}</p>
            </div>
            <div className="tour-list">
              {content.features.items.map((feature) => {
                const Icon = iconMap[feature.icon];

                return (
                  <article className="tour-row" key={feature.title}>
                    <div className="tour-icon">
                      <Icon aria-hidden="true" size={28} />
                    </div>
                    <div>
                      <h3>{feature.title}</h3>
                      <p>{feature.description}</p>
                    </div>
                    <p className="tour-detail">{feature.detail}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section
          className="gallery-section section-band"
          id="screenshots"
          aria-labelledby="screenshots-heading"
        >
          <div className="section-inner gallery-layout">
            <div className="gallery-copy">
              <p className="section-label">{content.screenshots.label}</p>
              <h2 id="screenshots-heading">{content.screenshots.heading}</h2>
              <p>{content.screenshots.description}</p>
              <div className="segmented-control" role="group">
                {content.screenshots.items.map((screenshot) => (
                  <button
                    key={screenshot.id}
                    type="button"
                    aria-pressed={selectedScreenshot.id === screenshot.id}
                    onClick={() => setSelectedScreenshotId(screenshot.id)}
                  >
                    {screenshot.label}
                  </button>
                ))}
              </div>
            </div>
            <figure className="gallery-frame screenshot-frame">
              <img
                src={asset(selectedScreenshot.image)}
                alt={selectedScreenshot.alt}
              />
              <figcaption>
                <strong>{selectedScreenshot.title}</strong>
                <span>{selectedScreenshot.caption}</span>
              </figcaption>
            </figure>
          </div>
        </section>

        <section
          className="start-section section-band"
          id="start"
          aria-labelledby="start-heading"
        >
          <div className="section-inner start-layout">
            <div className="section-heading">
              <p className="section-label">{content.start.label}</p>
              <h2 id="start-heading">{content.start.heading}</h2>
              <p>{content.start.description}</p>
              <div className="start-actions">
                <a className="button button-primary" href={releasesUrl}>
                  <Download aria-hidden="true" size={20} />
                  {content.start.actions.releases}
                </a>
                <a
                  className="button button-secondary"
                  href={content.start.installationHref}
                >
                  <ExternalLink aria-hidden="true" size={19} />
                  {content.start.actions.installation}
                </a>
              </div>
              <p className="download-note">{content.start.note}</p>
            </div>
            <div className="platform-panel">
              <div
                className="platform-tabs"
                role="group"
                aria-label={content.platforms.label}
              >
                {content.platforms.items.map((platform) => {
                  const Icon = iconMap[platform.icon];

                  return (
                    <button
                      key={platform.id}
                      type="button"
                      aria-pressed={selectedPlatform.id === platform.id}
                      onClick={() => setSelectedPlatformId(platform.id)}
                    >
                      <Icon aria-hidden="true" size={18} />
                      {platform.label}
                    </button>
                  );
                })}
              </div>
              <div className="platform-detail">
                <SelectedPlatformIcon aria-hidden="true" size={32} />
                <div>
                  <h3>{selectedPlatform.title}</h3>
                  <p>{selectedPlatform.description}</p>
                  <ul>
                    {selectedPlatform.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          className="docs-section section-band"
          id="docs"
          aria-labelledby="docs-heading"
        >
          <div className="section-inner">
            <div className="section-heading section-heading-wide">
              <p className="section-label">{content.docs.label}</p>
              <h2 id="docs-heading">{content.docs.heading}</h2>
              <p>{content.docs.description}</p>
            </div>
            <div className="resource-grid">
              {content.docs.resources.map((resource) => {
                const Icon = iconMap[resource.icon];

                return (
                  <a
                    className="resource-card"
                    href={resource.href}
                    key={resource.title}
                  >
                    <Icon aria-hidden="true" size={24} />
                    <span>
                      <strong>{resource.title}</strong>
                      <small>{resource.description}</small>
                    </span>
                    <ExternalLink aria-hidden="true" size={18} />
                  </a>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="section-inner footer-layout">
          <div>
            <a className="brand footer-brand" href="#top">
              <img src={asset("Rexiano_icon.png")} alt="" />
              <span>Rexiano</span>
            </a>
            <p>{content.footer.sentence}</p>
          </div>
          <nav aria-label="Footer links">
            {content.footer.links.map((link) => (
              <a href={link.href} key={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}

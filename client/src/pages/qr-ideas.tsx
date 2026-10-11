import { Link, useLocation } from 'wouter';
import { ArrowRight, Sparkles } from 'lucide-react';
import SEO from '@/components/SEO';
import IdeaLinks, { IdeaTypes } from '@/components/IdeaLinks';
import { qrIdeas } from '@/data/qrIdeas';
import NotFound from '@/pages/not-found';

export default function QRIdeas() {
  const [location] = useLocation();
  const idea = qrIdeas.find(item => item.href === location);
  if (!idea?.detail) return <NotFound />;
  const { detail } = idea;
  return (
    <div className="row py-6">
      <SEO title={`${idea.title} | QR Gear Ideas`} description={idea.summary} />
      <section className="section row">
        <div className="vanity-header">
          <div className="vanity-header-icon"><Sparkles aria-hidden="true" /></div>
          <div className="vanity-header-text">
            <p className="vanity-category">Ideas &amp; Occasions</p>
            <h1 className="vanity-title">{idea.title}</h1>
          </div>
        </div>
        <p className="vanity-tagline">{detail.tagline}</p>
        <p className="vanity-description">{detail.intro}</p>
      </section>
      <section className="section row" aria-labelledby="idea-examples-title">
        <h2 id="idea-examples-title">Make it your own</h2>
        <div className="layout__split-2 mt-6">
          {detail.scenarios.map(scenario => (
            <article key={scenario.title}>
              <h3>{scenario.title}</h3>
              <p>{scenario.description}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="section row" aria-labelledby="idea-start-title">
        <h2 id="idea-start-title">Start with the story</h2>
        <ol className="list-decimal pl-6 space-y-3">
          {detail.start.map(step => <li key={step}>{step}</li>)}
        </ol>
      </section>
      {detail.related && <div className="row py-4">
        {detail.related.map(link => <Link key={link.href} href={link.href} className="vanity-btn-outline">{link.title} <ArrowRight aria-hidden="true" /></Link>)}
      </div>}
      <IdeaTypes href={idea.href} />
      <div className="btn-row py-4">
        <Link href="/build" className="vanity-cta">Create Your QR Gear <ArrowRight aria-hidden="true" /></Link>
        <Link href="/" className="vanity-back">Back to home</Link>
      </div>
      <section className="section row" aria-labelledby="more-ideas-title">
        <h2 id="more-ideas-title">More ideas &amp; occasions</h2>
        <IdeaLinks compact exclude={[idea.href]} />
      </section>
    </div>
  );
}

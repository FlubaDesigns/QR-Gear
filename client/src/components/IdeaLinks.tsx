import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';
import { actionCards } from '@/components/ActionCards';
import { qrIdeas } from '@/data/qrIdeas';

export default function IdeaLinks({ typeHref, exclude = [] }: { typeHref?: string; exclude?: string[] }) {
  const ideas = typeHref ? qrIdeas.filter(idea => idea.types.includes(typeHref) && !exclude.includes(idea.href)) : qrIdeas;
  return (
    <div className="row">
      <div className="layout__auto">
        {ideas.map(idea => (
          <Link key={idea.href} href={idea.href} className="action-card" data-testid={`idea-${idea.href.slice(1)}`}>
            <div className="glass-card action-card-inner hover-elevate">
              <h3>{idea.title}</h3>
              <p className="action-card-description">{idea.summary}</p>
              <span className="flex-row">Explore ideas <ArrowRight className="w-4 h-4" aria-hidden="true" /></span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function IdeaTypes({ href }: { href: string }) {
  const idea = qrIdeas.find(item => item.href === href);
  if (!idea) throw new Error(`Unknown QR idea: ${href}`);
  return (
    <section className="section row" aria-labelledby="idea-types-title">
      <h2 id="idea-types-title">Explore the QR types for this idea</h2>
      <div className="layout__auto">
        {actionCards.filter(type => idea.types.includes(type.href)).map(type => (
          <Link key={type.href} href={type.href} className="action-card" data-testid={`idea-type-${type.href.slice(1)}`}>
            <div className="glass-card action-card-inner hover-elevate">
              <h3>{type.title}</h3><p className="action-card-description">{type.description}</p>
              <span className="flex-row">See how it works <ArrowRight className="w-4 h-4" aria-hidden="true" /></span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

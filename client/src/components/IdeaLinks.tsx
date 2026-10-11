import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';
import { actionCards } from '@/components/ActionCards';
import { qrIdeas } from '@/data/qrIdeas';

export default function IdeaLinks({ typeHref, exclude = [], compact = false }: { typeHref?: string; exclude?: string[]; compact?: boolean }) {
  const ideas = qrIdeas.filter(idea => (!typeHref || idea.types.includes(typeHref)) && !exclude.includes(idea.href));
  if (compact) return (
    <ul className="flex-row wrap list-none p-0">
      {ideas.map(idea => (
        <li key={idea.href} className="mr-6">
          <Link href={idea.href} className="inline-flex items-center min-h-12 py-3 underline underline-offset-4" data-testid={`idea-${idea.href.slice(1)}`}>{idea.title}</Link>
        </li>
      ))}
    </ul>
  );
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
      <h2 id="idea-types-title">Choose your QR type</h2>
      <ul className="flex-row wrap list-none p-0">
        {actionCards.filter(type => idea.types.includes(type.href)).map(type => (
          <li key={type.href} className="mr-6">
            <Link href={type.href} className="inline-flex items-center min-h-12 py-3 underline underline-offset-4" data-testid={`idea-type-${type.href.slice(1)}`}>{type.title} <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" /></Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

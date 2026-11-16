import { useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import './display-cards.css';

interface DisplayCardProps {
  icon: ReactNode;
  title: string;
  description: ReactNode;
}

export default function DisplayCards({ cards, className }: { cards: DisplayCardProps[]; className?: string }) {
  const [current, setCurrent] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const count = cards.length;
  if (!count) return null;
  const active = current % count;
  const move = (step: number) => setCurrent(index => (index + step + count) % count);

  return (
    <section className={cn('crunch-stack', className)} aria-label="Business stories" aria-roledescription="carousel"
      tabIndex={0} onKeyDown={event => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          move(event.key === 'ArrowRight' ? 1 : -1);
        }
      }}>
      <div className="stack-stage" onTouchStart={event => {
        const touch = event.touches[0];
        start.current = event.touches.length === 1 ? { x: touch.clientX, y: touch.clientY } : null;
      }} onTouchCancel={() => { start.current = null; }} onTouchEnd={event => {
        if (!start.current) return;
        const dx = event.changedTouches[0].clientX - start.current.x;
        const dy = event.changedTouches[0].clientY - start.current.y;
        start.current = null;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.4) move(dx < 0 ? 1 : -1);
      }}>
        {cards.map((card, index) => {
          const depth = (index - active + count) % count;
          return (
            <div className="stack-sheet" key={card.title} data-depth={depth} aria-hidden={depth !== 0}
              role="group" aria-roledescription="slide" aria-label={card.title}>
              <div className="stack-heading"><span aria-hidden="true">{card.icon}</span><h3>{card.title}</h3></div>
              {card.description}
            </div>
          );
        })}
      </div>
      {count > 1 && <div className="stack-controls">
        <button type="button" aria-label="Previous story" onClick={() => move(-1)}><ChevronLeft /></button>
        <span aria-live="polite">{active + 1} / {count} · {cards[active].title}</span>
        <button type="button" aria-label="Next story" onClick={() => move(1)}><ChevronRight /></button>
      </div>}
    </section>
  );
}

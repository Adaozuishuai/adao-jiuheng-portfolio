'use client';

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';

type Heading = { id: string; title: string; level: number };

export function ArticleToc({
  headings,
  className,
}: {
  headings: Heading[];
  className: string;
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const groups: { heading: Heading; children: Heading[] }[] = [];
  for (const heading of headings) {
    const previous = groups.at(-1);
    if (heading.level === 3 && previous?.heading.level === 2)
      previous.children.push(heading);
    else groups.push({ heading, children: [] });
  }
  if (!headings.length) return null;
  return (
    <div className={className}>
      <button
        className="toc-toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <ChevronRight size={14} aria-hidden="true" />
        本文目录
      </button>
      {open && (
        <nav aria-label="文章目录">
          {groups.map(({ heading, children }) => (
            <div key={heading.id}>
              <div className="toc-row">
                <a href={`#${heading.id}`}>{heading.title}</a>
                {children.length > 0 && (
                  <button
                    className="toc-toggle"
                    aria-label={`${heading.title}的子目录`}
                    aria-expanded={expanded.has(heading.id)}
                    onClick={() => {
                      setExpanded((current) => {
                        const next = new Set(current);
                        if (next.has(heading.id)) next.delete(heading.id);
                        else next.add(heading.id);
                        return next;
                      });
                    }}
                  >
                    <ChevronRight size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
              {expanded.has(heading.id) &&
                children.map((child) => (
                  <a className="toc-child" key={child.id} href={`#${child.id}`}>
                    {child.title}
                  </a>
                ))}
            </div>
          ))}
        </nav>
      )}
    </div>
  );
}

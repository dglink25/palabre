import { useEffect, useRef, useState } from 'react';

/**
 * Sommaire de navigation avec surlignage de la section active au scroll.
 * sections: [{ id, n, title }]
 */
export default function LegalToc({ sections }) {
  const [activeId, setActiveId] = useState(sections[0]?.id || '');
  const observerRef = useRef(null);

  useEffect(() => {
    const headings = sections.map(({ id }) => document.getElementById(id)).filter(Boolean);

    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Trouve la section la plus haute qui est visible
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-10% 0px -75% 0px', threshold: 0 }
    );

    headings.forEach((h) => observerRef.current.observe(h));
    return () => observerRef.current?.disconnect();
  }, [sections]);

  return (
    <aside className="legal-toc">
      <div className="legal-toc-title">Sommaire</div>
      {sections.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className={activeId === s.id ? 'toc-active' : ''}
          onClick={(e) => {
            e.preventDefault();
            document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' });
            setActiveId(s.id);
          }}
        >
          <span className="legal-toc-num">{s.n}</span>
          {s.title}
        </a>
      ))}
    </aside>
  );
}

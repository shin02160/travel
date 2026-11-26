import { useEffect, useId, useRef, useState } from 'react';

export default function ExpandableText({ text }) {
  const id = useId();
  const content = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(text.length > 140 || text.split('\n').length > 4);
  useEffect(() => {
    if (expanded) return;
    let active = true;
    const measure = () => {
      if (active && content.current) setOverflowing(content.current.scrollHeight > content.current.clientHeight + 1);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(content.current);
    document.fonts?.ready.then(measure);
    return () => { active = false; observer.disconnect(); };
  }, [text, expanded]);
  return <div className="travel-expandable">
    <div ref={content} id={id} className="travel-expandable-text" data-expanded={expanded}>{text}</div>
    {(overflowing || expanded) && <button type="button" className="travel-link-button"
      aria-controls={id} aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
      {expanded ? '접기' : '더 보기'}
    </button>}
  </div>;
}

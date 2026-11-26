import { useEffect, useId, useRef } from 'react';
import { Icon } from '../icons.jsx';

export default function TravelNavigation({ tabs, icons, selected, onSelect }) {
  const list = useRef(null), chooser = useRef(null);
  const id = useId();
  useEffect(() => {
    const container = list.current;
    const active = container.querySelector('[aria-pressed="true"]');
    if (!active || container.scrollWidth <= container.clientWidth) return;
    const box = container.getBoundingClientRect(), button = active.getBoundingClientRect();
    if (button.left < box.left) container.scrollLeft -= box.left - button.left + 8;
    else if (button.right > box.right) container.scrollLeft += button.right - box.right + 8;
  }, [selected]);
  useEffect(() => {
    const dismiss = event => {
      if (chooser.current && !chooser.current.contains(event.target)) chooser.current.open = false;
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);
  const choose = key => {
    chooser.current.open = false;
    onSelect(key);
    requestAnimationFrame(() => list.current?.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true }));
  };
  return <div className="travel-navigation">
    <nav ref={list} aria-label="여행 정보" className="travel-reader-tabs">
      {Object.entries(tabs).map(([key, label]) => <button key={key} type="button"
        aria-pressed={selected === key} onClick={() => onSelect(key)}>
        <span className="travel-icon" aria-hidden="true"><Icon name={icons[key]} size={18} /></span>{label}
      </button>)}
    </nav>
    <details ref={chooser} className="travel-navigation-chooser" onKeyDown={event => {
      if (event.key === 'Escape') { chooser.current.open = false; chooser.current.querySelector('summary').focus(); }
    }}>
      <summary aria-controls={id}>전체 메뉴</summary>
      <nav id={id} aria-label="전체 여행 메뉴" className="travel-navigation-options">
        {Object.entries(tabs).map(([key, label]) => <button key={key} type="button"
          aria-pressed={selected === key} onClick={() => choose(key)}>{label}</button>)}
      </nav>
    </details>
  </div>;
}

// Lucide-style stroke SVG icons
const icon = (paths, size = 18) => ({ size, paths });

export function Icon({ name, size = 18, color = 'currentColor', strokeWidth = 1.8 }) {
  const defs = {
    plane: ['M2.5 19 L12 3 L21.5 19 L12 15.5 Z', 'M12 15.5 L12 3'],
    hotel: ['M3 9L12 2L21 9V20H3V9Z', 'M9 20V12H15V20'],
    music: ['M9 18V5l12-2v13', 'M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M18 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
    train: ['M4 4h16v12H4z', 'M8 20l4-4 4 4', 'M8 8h8', 'M8 12h8', 'M4 16h16'],
    map: ['M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3z', 'M9 4v13', 'M15 7v13'],
    home: ['M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10'],
    compass: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36z'],
    sparkles: ['M12 3L13.5 8.5H19L14.25 12L16 17.5L12 14L8 17.5L9.75 12L5 8.5H10.5Z'],
    settings: ['M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M12 8v4', 'M12 16h.01'],
    plus: ['M12 5v14', 'M5 12h14'],
    x: ['M18 6L6 18', 'M6 6l12 12'],
    check: ['M20 6L9 17 4 12'],
    chevronLeft: ['M15 18l-6-6 6-6'],
    chevronRight: ['M9 18l6-6-6-6'],
    chevronDown: ['M6 9l6 6 6-6'],
    moreVert: ['M12 5h.01', 'M12 12h.01', 'M12 19h.01'],
    search: ['M21 21l-4.35-4.35', 'M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0'],
    trash: ['M3 6h18', 'M19 6l-1 14H6L5 6', 'M9 6V4h6v2'],
    sync: ['M4 4v5h5', 'M20 20v-5h-5', 'M20 9A8 8 0 0 0 6.07 5.34', 'M4 15a8 8 0 0 0 13.93 3.66'],
    brain: ['M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.44-4.66z', 'M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.44-4.66z'],
    pin: ['M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z', 'M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
    currency: ['M12 2v20', 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'],
    wallet: ['M21 12V7H5a2 2 0 0 1 0-4h14v4', 'M3 5v14a2 2 0 0 0 2 2h16v-5', 'M18 12a2 2 0 0 0 0 4h4v-4z'],
    fileText: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M16 13H8', 'M16 17H8', 'M10 9H8'],
    user: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z'],
    lock: ['M18 11H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z', 'M8 11V7a4 4 0 1 1 8 0v4'],
    eye: ['M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
    eyeOff: ['M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24', 'M1 1l22 22'],
    arrowRight: ['M5 12h14', 'M12 5l7 7-7 7'],
    calendar: ['M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z', 'M16 2v4', 'M8 2v4', 'M3 10h18'],
    notion: ['M4 4h16v16H4z'], // placeholder
  };

  const paths = defs[name] || defs['check'];

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

export function BookingTypeIcon({ type, size = 36 }) {
  const map = { flight: 'plane', hotel: 'hotel', concert: 'music', transport: 'train' };
  return (
    <div style={{
      width: size, height: size, borderRadius: 10,
      background: 'var(--primary-tint)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <Icon name={map[type] || 'fileText'} size={size * 0.5} color="var(--primary)" />
    </div>
  );
}

// Ustoz yuzchasi: kayfiyatga qarab ko'z, og'iz va rang o'zgaradi.
// Foydalanish: Face.set(element, 'happy')
window.Face = (() => {
  const COLORS = {
    calm: '#a3a7ad',
    happy: '#2fb36d',
    excited: '#f59e0b',
    thinking: '#4f8ef7',
    surprised: '#a35cf0',
    angry: '#ef3b2d',
  };

  const L = 88; // chap ko'z
  const R = 152; // o'ng ko'z
  const Y = 78; // ko'zlar balandligi

  function star(cx, cy, r) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 ? r * 0.45 : r;
      const a = (Math.PI / 5) * i - Math.PI / 2;
      pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`);
    }
    return `<polygon points="${pts.join(' ')}" stroke-linejoin="round" stroke-width="2" stroke="var(--ink)"/>`;
  }

  const EYES = {
    calm: (x) => `<rect x="${x - 14}" y="${Y + 2}" width="28" height="6" rx="3"/>`,
    happy: (x) => `<path d="M${x - 13} ${Y + 6} Q${x} ${Y - 10} ${x + 13} ${Y + 6}" fill="none" stroke="var(--ink)" stroke-width="6" stroke-linecap="round"/>`,
    excited: (x) => star(x, Y, 14),
    thinking: (x) => `<circle cx="${x + 5}" cy="${Y - 4}" r="7"/>`,
    surprised: (x) => `<circle cx="${x}" cy="${Y}" r="10"/>`,
    angry: (x, left) =>
      `<rect x="${x - 14}" y="${Y - 2}" width="28" height="9" rx="4" transform="rotate(${left ? 18 : -18} ${x} ${Y + 2})"/>`,
  };

  const MOUTHS = {
    calm: '<rect class="mouth" x="106" y="100" width="28" height="14" rx="7"/>',
    happy: '<path class="mouth" d="M102 100 Q120 122 138 100 Z" stroke="var(--ink)" stroke-width="4" stroke-linejoin="round"/>',
    excited: '<path class="mouth" d="M100 98 H140 Q140 124 120 124 Q100 124 100 98 Z"/>',
    thinking: '<rect class="mouth" x="112" y="104" width="20" height="6" rx="3" transform="rotate(-8 122 107)"/>',
    surprised: '<ellipse class="mouth" cx="120" cy="108" rx="8" ry="10"/>',
    angry: '<path class="mouth" d="M104 112 Q120 98 136 112" fill="none" stroke="var(--ink)" stroke-width="6" stroke-linecap="round"/>',
  };

  // Jahl qilganda yuzcha tepasida yonadigan olov.
  function flames() {
    const xs = [48, 70, 92, 114, 136, 158, 180];
    const one = (x, h, color, i) =>
      `<path class="flame f${i % 3}" d="M${x - 12} 40 Q${x - 14} ${40 - h * 0.5} ${x} ${40 - h} Q${x + 14} ${40 - h * 0.5} ${x + 12} 40 Z" fill="${color}"/>`;
    return (
      '<g class="flames">' +
      xs.map((x, i) => one(x, 34 + (i % 2) * 10, '#ef3b2d', i)).join('') +
      xs.map((x, i) => one(x, 22 + (i % 2) * 6, '#f97316', i + 1)).join('') +
      xs.map((x, i) => one(x, 12, '#fbbf24', i + 2)).join('') +
      '</g>'
    );
  }

  function svg(mood) {
    const color = COLORS[mood] || COLORS.calm;
    const eyes = EYES[mood] || EYES.calm;
    return `<svg viewBox="0 0 240 150" aria-hidden="true" style="--mood:${color}">
      ${mood === 'angry' ? flames() : ''}
      <rect class="body" x="22" y="36" width="196" height="100" rx="50" fill="var(--face)" stroke="${color}" stroke-width="10"/>
      <g fill="var(--ink)">${eyes(L, true)}${eyes(R, false)}${MOUTHS[mood] || MOUTHS.calm}</g>
    </svg>`;
  }

  function set(el, mood) {
    if (!el) return;
    if (el.dataset.renderedFace === mood) return;
    el.dataset.face = mood;
    el.dataset.renderedFace = mood;
    el.innerHTML = svg(mood);
  }

  document.querySelectorAll('.face-slot').forEach((el) => set(el, el.dataset.face || 'calm'));

  return { set, MOODS: Object.keys(COLORS) };
})();

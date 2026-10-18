// Lightweight SVG Charts for Vanilla CreditFlow
import { formatMoney, formatDayMonth } from './format.js';

export function renderBarChart(container, data, options = {}) {
  // data: array of { label or date, value, value2 }
  if (!container || !data || data.length === 0) return;

  const height = options.height || 180;
  const barColor = options.barColor || '#0a4a5c'; // teal
  const barColor2 = options.barColor2 || '#f5a623'; // amber
  const maxVal = Math.max(...data.map((d) => Math.max(d.value || 0, d.value2 || 0)), 1);

  const paddingBottom = 26;
  const paddingTop = 10;
  const chartHeight = height - paddingBottom - paddingTop;
  const width = container.clientWidth || 360;
  const barWidth = Math.max(Math.floor((width / data.length) * 0.65), 6);
  const gap = width / data.length;

  let barsHtml = '';
  data.forEach((d, i) => {
    const x = i * gap + (gap - barWidth) / 2;
    const h1 = Math.round(((d.value || 0) / maxVal) * chartHeight);
    const y1 = paddingTop + chartHeight - h1;

    let secondBar = '';
    if (d.value2 !== undefined) {
      const h2 = Math.round(((d.value2 || 0) / maxVal) * chartHeight);
      const y2 = paddingTop + chartHeight - h2;
      const subBarWidth = barWidth / 2 - 1;
      secondBar = `
        <rect x="${x + subBarWidth + 2}" y="${y2}" width="${subBarWidth}" height="${Math.max(h2, 2)}" rx="2" fill="${barColor2}">
          <title>${d.label || d.date}: ${formatMoney(d.value2)}</title>
        </rect>
      `;
      barsHtml += `
        <rect x="${x}" y="${y1}" width="${subBarWidth}" height="${Math.max(h1, 2)}" rx="2" fill="${barColor}">
          <title>${d.label || d.date}: ${formatMoney(d.value)}</title>
        </rect>
        ${secondBar}
      `;
    } else {
      barsHtml += `
        <rect x="${x}" y="${y1}" width="${barWidth}" height="${Math.max(h1, 2)}" rx="3" fill="${barColor}">
          <title>${d.label || d.date}: ${formatMoney(d.value)}</title>
        </rect>
      `;
    }

    // Every few days show label
    const showLabel = data.length <= 14 ? true : i % Math.ceil(data.length / 7) === 0;
    if (showLabel) {
      const lbl = d.label || (d.date ? formatDayMonth(d.date) : '');
      barsHtml += `
        <text x="${x + barWidth / 2}" y="${height - 8}" text-anchor="middle" font-size="10" fill="#5b6475" font-family="var(--font-sans)">
          ${lbl}
        </text>
      `;
    }
  });

  const svg = `
    <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="overflow: visible;">
      <line x1="0" y1="${paddingTop + chartHeight}" x2="${width}" y2="${paddingTop + chartHeight}" stroke="#e3e6ec" stroke-width="1"/>
      ${barsHtml}
    </svg>
  `;

  container.innerHTML = svg;
}

export function renderPaceChart(container, paceData, options = {}) {
  // paceData: array of { date, expected, actual }
  if (!container || !paceData || paceData.length === 0) return;

  const height = options.height || 220;
  const width = container.clientWidth || 600;
  const paddingLeft = 40;
  const paddingRight = 15;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const maxVal = Math.max(
    ...paceData.map((d) => Math.max(d.expected || 0, d.actual || 0)),
    100
  );

  const getX = (i) => paddingLeft + (i / Math.max(paceData.length - 1, 1)) * chartWidth;
  const getY = (val) => paddingTop + chartHeight - (val / maxVal) * chartHeight;

  let expectedPoints = '';
  let actualPoints = '';
  let actualAreaPoints = `${getX(0)},${paddingTop + chartHeight} `;

  paceData.forEach((d, i) => {
    const x = getX(i);
    const yExp = getY(d.expected || 0);
    const yAct = getY(d.actual || 0);

    expectedPoints += `${i === 0 ? 'M' : 'L'} ${x} ${yExp} `;
    actualPoints += `${i === 0 ? 'M' : 'L'} ${x} ${yAct} `;
    actualAreaPoints += `${x},${yAct} `;
  });

  actualAreaPoints += `${getX(paceData.length - 1)},${paddingTop + chartHeight}`;

  // Y-axis gridlines
  let gridHtml = '';
  const yTicks = [0, Math.round(maxVal * 0.5), Math.round(maxVal)];
  yTicks.forEach((tick) => {
    const y = getY(tick);
    gridHtml += `
      <line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="#e3e6ec" stroke-dasharray="3 3"/>
      <text x="${paddingLeft - 8}" y="${y + 3}" text-anchor="end" font-size="10" fill="#5b6475" font-family="var(--font-sans)">
        ₹${(tick / 1000).toFixed(0)}k
      </text>
    `;
  });

  // X-axis labels
  let xLabelsHtml = '';
  const step = Math.ceil(paceData.length / 5);
  paceData.forEach((d, i) => {
    if (i % step === 0 || i === paceData.length - 1) {
      const x = getX(i);
      xLabelsHtml += `
        <text x="${x}" y="${height - 10}" text-anchor="middle" font-size="10" fill="#5b6475" font-family="var(--font-sans)">
          ${formatDayMonth(d.date)}
        </text>
      `;
    }
  });

  const svg = `
    <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="overflow: visible;">
      ${gridHtml}
      <polygon points="${actualAreaPoints}" fill="rgba(10, 74, 92, 0.1)"/>
      <path d="${expectedPoints}" fill="none" stroke="#f5a623" stroke-width="2.5" stroke-dasharray="4 4"/>
      <path d="${actualPoints}" fill="none" stroke="#0a4a5c" stroke-width="2.5"/>
      ${xLabelsHtml}
    </svg>
  `;

  container.innerHTML = svg;
}

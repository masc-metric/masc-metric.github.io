// Interactive sections for the MaSC page: the mask demo, the results dot plot
// and the code copy button. Numbers are the paper's Tables 1, 2 and 3
// (NeurIPS 2026). Plain SVG, no libraries.
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // kind: ours | metric | llm. rho is Spearman; value is the panel's statistic.
  var PANELS = [
    {
      id: 'cp', label: 'DreamBench++ concept', stat: 'Krippendorff α', lo: 0, hi: 0.7, ticks: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7],
      ceiling: { value: 0.658, label: 'human agreement +0.658' },
      sub: 'Concept preservation against pooled human ratings, 7,135 matched pairs.',
      insight: 'MaSC is the strongest non-LLM metric (α = +0.471), second only to GPT-4o (+0.499) and ahead of GPT-4V; it reaches 72% of the human inter-rater ceiling.',
      rows: [
        ['GPT-4o', 'llm', 0.499, 0.641], ['MaSC', 'ours', 0.471, 0.611], ['GPT-4V', 'llm', 0.432, 0.521],
        ['DreamSim', 'metric', 0.421, 0.599], ['SigLIP2 global pool', 'metric', 0.369, 0.557], ['DINOv3', 'metric', 0.345, 0.479],
        ['DIFT-SDXL', 'metric', 0.324, 0.502], ['DINO-I', 'metric', 0.311, 0.514], ['AM-RADIO', 'metric', 0.226, 0.541],
        ['CLIP-I', 'metric', 0.135, 0.533]
      ]
    },
    {
      id: 'orida', label: 'ORIDa real photos', stat: 'AUC', lo: 0.75, hi: 1.0, ticks: [0.75, 0.8, 0.85, 0.9, 0.95, 1.0],
      sub: 'Probability that a same-object pair scores above a different-object pair; 50 objects in 10 real environments.',
      insight: 'On real photos MaSC separates same-object from different-object pairs best of all (AUC 0.992), ahead of GPT-4o (0.986), whose 0–4 rubric produces many ties.',
      rows: [
        ['MaSC', 'ours', 0.992], ['GPT-4o', 'llm', 0.986], ['AM-RADIO', 'metric', 0.961], ['SigLIP2 global pool', 'metric', 0.954],
        ['DINOv3', 'metric', 0.942], ['DreamSim', 'metric', 0.873], ['DINO-I', 'metric', 0.848], ['DIFT-SDXL', 'metric', 0.834],
        ['CLIP-I', 'metric', 0.800]
      ]
    },
    {
      id: 'pf', label: 'DreamBench++ prompt', stat: 'Krippendorff α', lo: 0, hi: 0.7, ticks: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7],
      ceiling: { value: 0.563, label: 'human agreement +0.563' },
      sub: 'Prompt following against pooled human ratings, 6,607 pairs (style subjects excluded).',
      insight: 'Prompt following comes from the same forward pass at no extra encoder cost. It beats CLIP-T (+0.327) on the same backbone, but VQAScore and ImageReward lead: we do not claim the state of the art here.',
      rows: [
        ['GPT-4o', 'llm', 0.547, 0.656], ['VQAScore', 'metric', 0.504, 0.640], ['GPT-4V', 'llm', 0.485, 0.661],
        ['ImageReward', 'metric', 0.441, 0.611], ['MaSC', 'ours', 0.354, 0.538], ['CLIP-T', 'metric', 0.327, 0.477],
        ['SigLIP2 global pool', 'metric', 0.326, 0.466], ['HPSv3', 'metric', 0.299, 0.434]
      ]
    }
  ];
  var KIND = { ours: 'MaSC', metric: 'non-LLM metric', llm: 'LLM judge' };
  var COLOR = { ours: '#2563eb', metric: '#64748b', llm: '#64748b' };

  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function html(tag, cls, text, parent) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }
  function fmt(v, signed) {
    var s = Math.abs(v).toFixed(3);
    return v < 0 ? '−' + s : (signed ? '+' : '') + s;
  }
  function chips(parent, label, items, initial, onPick) {
    var row = html('div', 'chip-row', null, parent);
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', label);
    html('span', 'chip-label', label, row);
    var buttons = items.map(function (it) {
      var b = html('button', 'chip', it.label, row);
      b.type = 'button';
      b.setAttribute('aria-pressed', it.id === initial ? 'true' : 'false');
      b.addEventListener('click', function () {
        buttons.forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
        onPick(it.id);
      });
      return b;
    });
  }
  function tooltip(card) {
    var t = html('div', 'viz-tooltip', null, card);
    t.setAttribute('role', 'status');
    return {
      show: function (content, evt) {
        t.innerHTML = content;
        t.classList.add('is-on');
        var box = card.getBoundingClientRect();
        var x = evt.clientX - box.left + 14, y = evt.clientY - box.top + 14;
        if (x + t.offsetWidth > box.width - 8) x = evt.clientX - box.left - t.offsetWidth - 14;
        if (y + t.offsetHeight > box.height - 8) y = evt.clientY - box.top - t.offsetHeight - 14;
        t.style.left = Math.max(8, x) + 'px';
        t.style.top = Math.max(8, y) + 'px';
      },
      hide: function () { t.classList.remove('is-on'); }
    };
  }

  // ------------------------------------------------------------- mask demo
  function maskDemo(root) {
    var VIEWS = {
      image: 'A reference photo of the subject, and an image generated for “A photo of a vintage motorcycle on a lonely desert road, with mountains in the background.”',
      concept: '<strong>Concept preservation</strong> looks only inside the masks: every reference patch on the motorcycle finds its best match among the generated motorcycle’s patches.',
      background: '<strong>Prompt following</strong> looks only outside the mask, against the prompt with the subject removed: “A photo of a vintage on a lonely desert road, with mountains in the background.”'
    };
    var explain = root.querySelector('.mask-explain');
    var frames = root.querySelectorAll('.mask-frame');
    chips(root.querySelector('.mask-controls'), 'Show', [
      { id: 'image', label: 'Images' }, { id: 'concept', label: 'Concept (CP)' }, { id: 'background', label: 'Background (PF)' }
    ], 'image', show);
    function show(view) {
      Array.prototype.forEach.call(frames, function (f) {
        Array.prototype.forEach.call(f.querySelectorAll('img'), function (img) {
          img.style.opacity = img.getAttribute('data-view') === view ? 1 : 0;
        });
      });
      explain.innerHTML = VIEWS[view];
    }
    show('image');
  }

  // ------------------------------------------------------------- results
  function results(card, W) {
    var narrow = W < 560;
    var labelW = narrow ? 138 : 190, right = narrow ? 52 : 40, top = 30, rowH = 32;
    var state = card._state || (card._state = { panel: 'cp' });
    var tip = tooltip(card);
    var sub = card.querySelector('.viz-subtitle');
    chips(card, 'Benchmark', PANELS.map(function (p) { return { id: p.id, label: p.label }; }), state.panel,
      function (id) { state.panel = id; draw(id); });
    var svg = el('svg', { class: 'viz-svg', role: 'img' }, card);
    var keys = html('div', 'viz-legend', null, card);
    keys.innerHTML =
      '<span class="key"><span class="swatch dot" style="background:#2563eb"></span>MaSC</span>' +
      '<span class="key"><span class="swatch dot" style="background:#64748b"></span>Non-LLM metric</span>' +
      '<span class="key"><span class="swatch dot" style="background:#fff;border:2.5px solid #64748b;box-sizing:border-box"></span>LLM judge (hollow)</span>';
    var insight = html('div', 'viz-insight', null, card);
    insight.setAttribute('aria-live', 'polite');
    var details = html('details', 'viz-table-toggle', null, card);
    html('summary', null, 'Show as a table', details);
    var table = html('table', 'table is-narrow is-striped', null, details);

    function draw(id) {
      var p = PANELS.filter(function (q) { return q.id === id; })[0];
      var rows = p.rows.slice().sort(function (a, b) { return b[2] - a[2]; });
      var H = top + rows.length * rowH + 8;
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      svg.setAttribute('width', W); svg.setAttribute('height', H);
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      function X(v) { return labelW + (v - p.lo) / (p.hi - p.lo) * (W - labelW - right); }
      el('title', {}, svg).textContent = p.label + ', ' + p.stat + ': ' + rows.map(function (r) { return r[0] + ' ' + fmt(r[2]); }).join(', ');
      p.ticks.filter(function (v, i) { return !narrow || i % 2 === 0; }).forEach(function (v) {
        el('line', { class: 'grid-line', x1: X(v), x2: X(v), y1: top - 6, y2: H }, svg);
        el('text', { class: 'tick-label', x: X(v), y: top - 12, 'text-anchor': 'middle' }, svg).textContent = v.toFixed(2).replace(/0$/, '');
      });
      if (p.ceiling) {
        el('line', { class: 'ref-line', x1: X(p.ceiling.value), x2: X(p.ceiling.value), y1: top - 6, y2: H }, svg);
        el('text', { class: 'ref-label', x: X(p.ceiling.value) - 6, y: H - 6, 'text-anchor': 'end' }, svg).textContent = narrow ? 'human ' + fmt(p.ceiling.value, true) : p.ceiling.label;
      }
      rows.forEach(function (r, i) {
        var y = top + i * rowH + rowH / 2;
        var g = el('g', { style: reduceMotion ? '' : 'opacity:0;transition:opacity .35s ' + (i * 0.03) + 's' }, svg);
        el('text', { class: 'row-label' + (r[1] === 'ours' ? ' is-ours' : ''), x: labelW - 12, y: y + 4, 'text-anchor': 'end' }, g).textContent = r[0];
        // full-width row guide, not a stem: the AUC axis does not start at zero
        el('line', { x1: X(p.lo), x2: X(p.hi), y1: y, y2: y, stroke: r[1] === 'ours' ? '#dbeafe' : '#f1f5f9', 'stroke-width': r[1] === 'ours' ? 10 : 1.5, 'stroke-linecap': 'round' }, g);
        var dot = el('circle', { cx: X(r[2]), cy: y, r: 7, fill: r[1] === 'llm' ? '#ffffff' : COLOR[r[1]], stroke: r[1] === 'llm' ? COLOR.llm : '#ffffff', 'stroke-width': r[1] === 'llm' ? 2.5 : 2 }, g);
        el('text', { class: 'value-label', x: X(r[2]) + 12, y: y + 4, style: r[1] === 'ours' ? 'font-weight:700' : '' }, g).textContent = p.stat === 'AUC' ? r[2].toFixed(3) : fmt(r[2], true);
        var hit = el('rect', { class: 'hit', x: 0, y: y - rowH / 2, width: W, height: rowH }, g);
        hit.addEventListener('mousemove', function (e) {
          tip.show('<strong>' + r[0] + '</strong> · ' + KIND[r[1]] + '<br>' + p.stat + ' ' + (p.stat === 'AUC' ? r[2].toFixed(3) : fmt(r[2], true)) +
            (r[3] != null ? ' · Spearman ρ ' + fmt(r[3], true) : '') + '<br>rank ' + (i + 1) + ' of ' + rows.length, e);
          dot.setAttribute('r', 9);
        });
        hit.addEventListener('mouseleave', function () { tip.hide(); dot.setAttribute('r', 7); });
        if (!reduceMotion) requestAnimationFrame(function () { requestAnimationFrame(function () { g.style.opacity = 1; }); });
      });
      sub.textContent = p.sub;
      insight.textContent = p.insight;
      table.innerHTML = '<thead><tr><th>Metric</th><th>Kind</th><th>' + p.stat + '</th>' + (rows[0][3] != null ? '<th>Spearman ρ</th>' : '') + '</tr></thead><tbody>' +
        rows.map(function (r) {
          return '<tr><td>' + r[0] + '</td><td>' + KIND[r[1]] + '</td><td>' + (p.stat === 'AUC' ? r[2].toFixed(3) : fmt(r[2], true)) + '</td>' +
            (r[3] != null ? '<td>' + fmt(r[3], true) + '</td>' : '') + '</tr>';
        }).join('') + '</tbody>';
    }
    draw(state.panel);
  }

  function copyButtons() {
    Array.prototype.forEach.call(document.querySelectorAll('.code-block'), function (block) {
      var btn = block.querySelector('.copy-code'), code = block.querySelector('pre');
      if (!btn || !code) return;
      btn.addEventListener('click', function () {
        navigator.clipboard.writeText(code.textContent).then(function () {
          btn.textContent = 'Copied';
          setTimeout(function () { btn.textContent = 'Copy'; }, 1600);
        });
      });
    });
  }

  // Drawn in CSS pixels at the card's width so text keeps its size on a phone;
  // a resize redraws with the same selection.
  function mount(card, chart) {
    var head = Array.prototype.slice.call(card.children, 0, 2), drawn = 0, timer = null;
    function render() {
      var cs = getComputedStyle(card);
      var w = Math.floor(card.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
      if (Math.abs(w - drawn) < 2) return;
      drawn = w;
      Array.prototype.slice.call(card.children).forEach(function (n) { if (head.indexOf(n) < 0) card.removeChild(n); });
      chart(card, Math.max(280, w));
    }
    render();
    window.addEventListener('resize', function () { clearTimeout(timer); timer = setTimeout(render, 150); });
  }

  function init() {
    var demo = document.getElementById('mask-demo');
    if (demo) maskDemo(demo);
    var res = document.getElementById('fig-results');
    if (res) mount(res, results);
    copyButtons();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

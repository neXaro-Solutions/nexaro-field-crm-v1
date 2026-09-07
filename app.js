const KEY = 'nexaro-crm-v1';

let S = JSON.parse(
  localStorage.getItem(KEY) ||
  '{"leads":[],"tasks":[],"routes":[]}'
);

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const save = () => {
  localStorage.setItem(KEY, JSON.stringify(S));
};

const money = n =>
  new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR'
  }).format(Number(n) || 0);

const esc = v =>
  String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

function qualification(tpv) {
  tpv = Number(tpv) || 0;

  if (tpv >= 15000)
    return {
      level: 'A',
      text: 'Sehr starkes Potenzial'
    };

  if (tpv >= 10000)
    return {
      level: 'B',
      text: 'Stark qualifiziert'
    };

  if (tpv >= 5000)
    return {
      level: 'C',
      text: 'Qualifiziert'
    };

  return {
    level: 'D',
    text: 'Unter internem Ziel von 5.000 €'
  };
}

function tariff(tpv) {
  tpv = Number(tpv) || 0;

  const payg = tpv * 0.0139;
  const plus = tpv * 0.0079 + 19;

  if (plus < payg) {
    return {
      name: 'Zahlungen Plus',
      monthly: plus,
      fee: '0,79 %',
      saving: payg - plus
    };
  }

  return {
    name: 'Umsatzbasiertes Zahlen',
    monthly: payg,
    fee: '1,39 %',
    saving: 0
  };
}

/*
  Interne Vertriebslogik.
  Diese Werte werden NICHT als Kundenpreis angezeigt.
*/
function commission(tpv) {
  tpv = Number(tpv) || 0;

  const activation = tpv >= 500 ? 200 : 0;

  const annualized =
    tpv * 0.007 * 12 * 0.5;

  const day30 =
    Math.max(0, annualized - activation);

  const master =
    tpv > 15000 ? 100 : 0;

  return {
    activation,
    day30,
    master,
    total: activation + day30 + master
  };
}

function openLead(id) {
  const f = $('#form');

  if (!f) return;

  f.reset();

  if (id) {
    const l = S.leads.find(x => x.id === id);

    if (l) {
      Object.keys(l).forEach(k => {
        const e = f.querySelector(`[name="${k}"]`);

        if (e) {
          e.value = l[k] ?? '';
        }
      });
    }
  }

  const dialog =
    $('#leadDialog') ||
    $('dialog');

  if (dialog && typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else if (dialog) {
    dialog.show();
  }
}

function closeLead() {
  const dialog =
    $('#leadDialog') ||
    $('dialog');

  if (dialog?.close) {
    dialog.close();
  }
}

function injectTPV() {
  const f = $('#form');

  if (!f) return;

  if (f.querySelector('[name="tpv"]')) return;

  const box = document.createElement('div');

  box.innerHTML = `
    <label>
      Monatliches Kartenzahlungsvolumen (TPV) €
      <input
        name="tpv"
        type="number"
        min="0"
        step="100"
        inputmode="decimal"
        placeholder="z. B. 10000"
      >
    </label>
  `;

  const first =
    f.querySelector('label');

  if (first) {
    first.before(box.firstElementChild);
  } else {
    f.appendChild(box.firstElementChild);
  }
}

function collectForm() {
  const f = $('#form');

  if (!f) return null;

  const data = {};

  new FormData(f).forEach((v, k) => {
    data[k] = v;
  });

  data.id =
    data.id ||
    Date.now().toString();

  data.tpv =
    Number(data.tpv) || 0;

  data.created =
    data.created ||
    new Date().toISOString();

  return data;
}

function saveLead() {
  const data = collectForm();

  if (!data) return;

  const existing =
    S.leads.findIndex(x => x.id === data.id);

  if (existing >= 0) {
    S.leads[existing] = {
      ...S.leads[existing],
      ...data
    };
  } else {
    S.leads.unshift(data);
  }

  save();
  closeLead();
  render();
}

function deleteLead(id) {
  if (!confirm('Diesen Lead wirklich löschen?')) {
    return;
  }

  S.leads =
    S.leads.filter(x => x.id !== id);

  save();
  render();
}

function leadCard(l) {
  const q = qualification(l.tpv);
  const t = tariff(l.tpv);

  return `
    <div class="card lead-card">

      <h3>
        ${esc(l.firma || 'Ohne Firmenname')}
      </h3>

      <p>
        ${esc(l.branche || '')}
        ·
        ${esc(l.status || 'Neu')}
      </p>

      <p>
        <strong>TPV:</strong>
        ${money(l.tpv)}
      </p>

      <p>
        <strong>Qualifizierung:</strong>
        ${esc(q.text)}
      </p>

      <p>
        <strong>Tarif:</strong>
        ${esc(t.name)}
      </p>

      <div class="actions">

        <button
          type="button"
          onclick="openLead('${esc(l.id)}')">
          Bearbeiten
        </button>

        <button
          type="button"
          onclick="deleteLead('${esc(l.id)}')">
          Löschen
        </button>

      </div>

    </div>
  `;
}

function renderDashboard() {
  const leads = S.leads || [];
  const tasks = S.tasks || [];

  const today =
    new Date().toISOString().slice(0, 10);

  const openTasks =
    tasks.filter(t => !t.done);

  const todayTasks =
    openTasks.filter(t =>
      String(t.due || '').startsWith(today)
    );

  const won =
    leads.filter(l =>
      String(l.status || '').toLowerCase()
        .includes('gewonnen')
    );

  const appointments =
    leads.filter(l =>
      l.termin ||
      String(l.status || '').toLowerCase()
        .includes('termin')
    );

  $$('[data-stat]').forEach(e => {
    const type = e.dataset.stat;

    if (type === 'leads')
      e.textContent = leads.length;

    if (type === 'tasks')
      e.textContent = todayTasks.length;

    if (type === 'won')
      e.textContent = won.length;

    if (type === 'appointments')
      e.textContent = appointments.length;
  });
}

function renderLeads() {
  const container =
    $('#leadsList') ||
    $('[data-leads-list]');

  if (!container) return;

  const search = $('#search');

  let leads = [...S.leads];

  if (search?.value.trim()) {
    const q =
      search.value
        .trim()
        .toLowerCase();

    leads =
      leads.filter(l =>
        JSON.stringify(l)
          .toLowerCase()
          .includes(q)
      );
  }

  if (!leads.length) {
    container.innerHTML = `
      <div class="empty">
        Noch keine Leads vorhanden.
      </div>
    `;
    return;
  }

  container.innerHTML =
    leads.map(leadCard).join('');
}

function renderTasks() {
  const container =
    $('#tasksList') ||
    $('[data-tasks-list]');

  if (!container) return;

  if (!S.tasks.length) {
    container.innerHTML = `
      <div class="empty">
        Keine offenen Aufgaben.
      </div>
    `;
    return;
  }

  container.innerHTML =
    S.tasks.map((t, i) => `
      <div class="card task-card">

        <label>
          <input
            type="checkbox"
            ${t.done ? 'checked' : ''}
            onchange="toggleTask(${i})"
          >
          ${esc(t.title || 'Aufgabe')}
        </label>

        ${t.due
          ? `<small>Fällig: ${esc(t.due)}</small>`
          : ''
        }

      </div>
    `).join('');
}

function toggleTask(i) {
  if (!S.tasks[i]) return;

  S.tasks[i].done =
    !S.tasks[i].done;

  save();
  render();
}

function render() {
  renderDashboard();
  renderLeads();
  renderTasks();
  updateAssistant();
}

function updateAssistant() {
  const output =
    $('#assistantOutput') ||
    $('[data-assistant-output]');

  const tpv =
    Number($('#assistantTPV')?.value) || 0;

  if (!output) return;

  if (!tpv) {
    output.innerHTML = `
      <p>
        TPV eingeben, um die
        Vertriebsanalyse zu erhalten.
      </p>
    `;
    return;
  }

  const q = qualification(tpv);
  const t = tariff(tpv);

  output.innerHTML = `
    <div class="card">

      <h3>Sales Assistant</h3>

      <p>
        <strong>TPV:</strong>
        ${money(tpv)}
      </p>

      <p>
        <strong>Qualifizierung:</strong>
        ${esc(q.text)}
      </p>

      <p>
        <strong>Passender Tarif:</strong>
        ${esc(t.name)}
      </p>

      <p>
        <strong>Monatliche Kosten bei diesem
        Rechenmodell:</strong>
        ${money(t.monthly)}
      </p>

      ${
        t.saving > 0
          ? `<p>
              Mögliche Ersparnis gegenüber
              1,39 %:
              <strong>${money(t.saving)}/Monat</strong>
            </p>`
          : ''
      }

      <p>
        <strong>Vertriebshinweis:</strong>
        ${
          tpv >= 15000
            ? 'Sehr hohes Potenzial – Termin priorisieren.'
            : tpv >= 10000
              ? 'Starkes Potenzial – aktiv weiterqualifizieren.'
              : tpv >= 5000
                ? 'Qualifiziertes Potenzial – Angebot vorbereiten.'
                : 'Unter internem Ziel – Bedarf und Volumen weiter prüfen.'
        }
      </p>

    </div>
  `;
}

function calculateAssistant() {
  updateAssistant();
}

function addTask() {
  const title =
    prompt('Neue Aufgabe');

  if (!title?.trim()) return;

  S.tasks.push({
    id: Date.now().toString(),
    title: title.trim(),
    due: '',
    done: false
  });

  save();
  render();
}

function exportData() {
  const blob = new Blob(
    [JSON.stringify(S, null, 2)],
    { type: 'application/json' }
  );

  const url =
    URL.createObjectURL(blob);

  const a =
    document.createElement('a');

  a.href = url;

  a.download =
    'nexaro-field-crm-backup-' +
    new Date()
      .toISOString()
      .slice(0, 10) +
    '.json';

  a.click();

  URL.revokeObjectURL(url);
}

function importData(file) {
  if (!file) return;

  const reader =
    new FileReader();

  reader.onload = () => {
    try {
      const data =
        JSON.parse(reader.result);

      if (
        !data ||
        !Array.isArray(data.leads)
      ) {
        throw new Error();
      }

      S = {
        leads: data.leads || [],
        tasks: data.tasks || [],
        routes: data.routes || []
      };

      save();
      render();

      alert('Backup erfolgreich importiert.');
    } catch {
      alert('Die Backup-Datei konnte nicht gelesen werden.');
    }
  };

  reader.readAsText(file);
}

function setupNavigation() {
  $$('nav button').forEach(b => {
    b.addEventListener('click', () => {
      const target = b.dataset.s;

      $$('nav button').forEach(x => {
        x.classList.remove('active');
      });

      b.classList.add('active');

      $$('.screen').forEach(view => {
        view.classList.toggle('active', view.id === target);
      });

      render();
    });
  });
}

function setupForm() {
  const f = $('#form');

  if (!f) return;

  f.addEventListener('submit', e => {
    e.preventDefault();
    saveLead();
  });
}

function setupSearch() {
  const search = $('#search');

  if (!search) return;

  search.addEventListener(
    'input',
    renderLeads
  );
}

function setupButtons() {
  $$('[data-action]').forEach(btn => {

    const action =
      btn.dataset.action;

    if (action === 'new-lead') {
      btn.addEventListener(
        'click',
        () => openLead()
      );
    }

    if (action === 'close-lead') {
      btn.addEventListener(
        'click',
        closeLead
      );
    }

    if (action === 'add-task') {
      btn.addEventListener(
        'click',
        addTask
      );
    }

    if (action === 'export') {
      btn.addEventListener(
        'click',
        exportData
      );
    }

    if (action === 'assistant') {
      btn.addEventListener(
        'click',
        calculateAssistant
      );
    }
  });
}

function setupImport() {
  const input =
    $('#importFile');

  if (!input) return;

  input.addEventListener(
    'change',
    () => importData(input.files[0])
  );
}

function boot() {
  injectTPV();
  setupNavigation();
  setupForm();
  setupSearch();
  setupButtons();
  setupImport();
  render();
}

document.addEventListener(
  'DOMContentLoaded',
  boot
);

window.openLead = openLead;
window.closeLead = closeLead;
window.deleteLead = deleteLead;
window.toggleTask = toggleTask;
window.exportData = exportData;
window.calculateAssistant = calculateAssistant;
window.saveLead = saveLead;

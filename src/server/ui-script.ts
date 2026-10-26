/** 브라우저에서 실행되는 대시보드 스크립트. 모든 동적 데이터는 textContent 또는 esc() 를 거친다. */
export const DASHBOARD_SCRIPT = `
const TOKEN = document.documentElement.dataset.token;
const CARD_LIMIT = 300, DESCRIPTION_LIMIT = 280;
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const setStatus = (t) => { $('#status').textContent = t; };
const state = { installed: [], sources: [] };

async function api(method, path, body) {
  const res = await fetch(path, { method, headers: { 'Content-Type': 'application/json', 'X-Ash-Token': TOKEN }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

function installedItem(s) {
  return '<li><span>' + esc(s.skillName) + ' <span class="tag">' + esc(s.scope) + '</span></span>'
    + '<button data-uninstall="' + esc(s.skillName) + '" data-scope="' + esc(s.scope) + '">제거</button></li>';
}
function sourceItem(s) {
  return '<li><a href="https://github.com/' + esc(s.repo) + '" target="_blank" rel="noopener">' + esc(s.repo) + '</a>'
    + '<button data-rmsource="' + esc(s.repo) + '">삭제</button></li>';
}
function card(e, installed) {
  const tags = (e.category ? '<span class="tag">' + esc(e.category) + '</span>' : '') + (e.model ? '<span class="tag">' + esc(e.model) + '</span>' : '');
  const description = e.description.length > DESCRIPTION_LIMIT ? e.description.slice(0, DESCRIPTION_LIMIT) + '…' : e.description;
  return '<div class="card"><div><h3>' + esc(e.skillName) + (installed ? ' <span class="tag installed">설치됨</span>' : '') + '</h3>'
    + '<div class="meta">' + esc(e.repo) + ' · ' + esc(e.path) + ' ' + tags + '</div></div>'
    + '<div><button data-preview="' + esc(e.id) + '">미리보기</button> <button class="primary" data-install="' + esc(e.id) + '"' + (installed ? ' disabled' : '') + '>설치</button></div>'
    + '<p>' + esc(description) + '</p></div>';
}

async function loadSide() {
  [state.installed, state.sources] = await Promise.all([api('GET', '/api/installed'), api('GET', '/api/sources')]);
  $('#installed').innerHTML = state.installed.length ? state.installed.map(installedItem).join('') : '<li class="meta">없음</li>';
  $('#sources').innerHTML = state.sources.map(sourceItem).join('');
  const repoSel = $('#repo'); const current = repoSel.value;
  repoSel.innerHTML = '<option value="">모든 레포</option>' + state.sources.map((s) => '<option' + (s.repo === current ? ' selected' : '') + '>' + esc(s.repo) + '</option>').join('');
}

async function loadList() {
  const data = await api('GET', '/api/catalog?q=' + encodeURIComponent($('#q').value) + '&repo=' + encodeURIComponent($('#repo').value));
  const installedIds = new Set(state.installed.map((s) => s.entryId));
  const updated = data.updatedAt.startsWith('1970') ? '갱신 안 됨' : '갱신 ' + new Date(data.updatedAt).toLocaleString();
  setStatus(data.entries.length + ' / ' + data.total + '개 · ' + updated);
  $('#list').innerHTML = data.entries.length
    ? data.entries.slice(0, CARD_LIMIT).map((e) => card(e, installedIds.has(e.id))).join('')
    : '<p class="meta">결과가 없습니다. 먼저 "카탈로그 갱신"을 눌러 GitHub에서 에이전트를 가져오세요.</p>';
}

async function refresh() { try { await loadSide(); await loadList(); } catch (e) { setStatus('오류: ' + e.message); } }

async function runUpdate(button) {
  button.disabled = true; setStatus('GitHub에서 가져오는 중…');
  const reports = await api('POST', '/api/update');
  setStatus(reports.map((r) => r.repo + ': ' + (r.error ? '실패' : r.indexed + '개')).join(' · '));
  button.disabled = false; await loadList();
}

async function handleClick(button) {
  const d = button.dataset;
  if (button.id === 'update') return runUpdate(button);
  if (d.install) { button.disabled = true; const r = await api('POST', '/api/install', { entryId: d.install, scope: $('#scope').value }); setStatus('설치됨: ' + r.path); return refresh(); }
  if (d.preview) { $('#preview').textContent = '불러오는 중…'; const r = await api('GET', '/api/preview?entryId=' + encodeURIComponent(d.preview)); $('#preview').textContent = r.markdown; return; }
  if (d.uninstall) { await api('POST', '/api/uninstall', { skillName: d.uninstall, scope: d.scope }); return refresh(); }
  if (d.rmsource) { await api('DELETE', '/api/sources?repo=' + encodeURIComponent(d.rmsource)); return refresh(); }
}

document.addEventListener('click', async (ev) => {
  const button = ev.target.closest('button'); if (!button) return;
  try { await handleClick(button); } catch (e) { setStatus('오류: ' + e.message); button.disabled = false; }
});
$('#addSource').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  try { await api('POST', '/api/sources', { repo: $('#newRepo').value.trim() }); $('#newRepo').value = ''; await refresh(); } catch (e) { setStatus('오류: ' + e.message); }
});
let timer; $('#q').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(loadList, 200); });
$('#repo').addEventListener('change', loadList);
refresh();
`

import { DASHBOARD_SCRIPT } from './ui-script.js'
import { DASHBOARD_STYLES } from './ui-styles.js'

/** 대시보드 단일 페이지 HTML. 토큰은 data 속성으로 심어 API 호출 헤더에 쓴다. */
export function renderDashboardHtml(token: string): string {
  const safeToken = token.replace(/[^A-Za-z0-9]/g, '')
  return `<!doctype html>
<html lang="ko" data-token="${safeToken}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Agent Skill Hub</title>
<style>${DASHBOARD_STYLES}</style>
</head>
<body>
<header>
  <h1>Agent Skill Hub</h1>
  <input id="q" placeholder="에이전트 검색 (예: security, backend, react)">
  <select id="repo"><option value="">모든 레포</option></select>
  <select id="scope"><option value="global">전역 (~/.claude/skills)</option><option value="project">프로젝트 (./.claude/skills)</option></select>
  <button id="update" class="primary">카탈로그 갱신</button>
  <span id="status"></span>
</header>
<main>
  <div id="list"></div>
  <aside>
    <section><h2>설치된 스킬</h2><ul id="installed"></ul></section>
    <section><h2>소스 레포</h2><ul id="sources"></ul>
      <form id="addSource"><input id="newRepo" placeholder="owner/repo"><button>추가</button></form>
    </section>
    <section><h2>미리보기</h2><pre id="preview">카드의 "미리보기"를 누르면 SKILL.md가 여기 표시됩니다.</pre></section>
  </aside>
</main>
<script>${DASHBOARD_SCRIPT}</script>
</body>
</html>`
}

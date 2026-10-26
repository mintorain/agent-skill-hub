# Agent Skill Hub (`ash`)

GitHub에 공개된 **AI 에이전트 정의**(Claude Code 서브에이전트 형식 `.md`)를 찾아서
**Claude Skill**(`SKILL.md`, [agentskills.io 스펙](https://agentskills.io/specification))로 변환하고
`~/.claude/skills` 또는 프로젝트 `.claude/skills`에 설치해 주는 플랫폼입니다.
CLI와 로컬 웹 대시보드를 함께 제공합니다.

```
GitHub 레포 ──(크롤링)──▶ 카탈로그 ──(검색)──▶ 변환 ──(설치)──▶ ~/.claude/skills/<name>/SKILL.md
```

## 기본 소스 레포 (GitHub 조사로 선정)

| 레포 | 에이전트 수 | 비고 |
|---|---|---|
| [wshobson/agents](https://github.com/wshobson/agents) | 202 | 플러그인 마켓플레이스 `plugins/*/agents/*.md` |
| [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) | 163 | 카테고리별 `categories/**/*.md` |
| [lst97/claude-code-sub-agents](https://github.com/lst97/claude-code-sub-agents) | 37 | 풀스택 개발 `agents/**/*.md` |
| [iannuttall/claude-agents](https://github.com/iannuttall/claude-agents) | 7 | `agents/*.md` |

`ash sources add owner/repo` 로 어떤 레포든 추가할 수 있습니다.

## 설치

```bash
cd agent-skill-hub
npm install
npm run build        # dist/ 생성
npm link             # 전역 `ash` 명령 등록 (선택)
```

GitHub API 제한(비인증 60회/시간)을 피하려면 토큰을 설정하세요.

```bash
export GITHUB_TOKEN=$(gh auth token)
```

## 사용법

```bash
ash update                               # 소스 레포를 크롤링해 카탈로그 갱신 (약 20초, 400+ 에이전트)
ash search security                      # 검색 (이름 > 카테고리 > 설명 순 가중치)
ash search react -r wshobson/agents -n 5 # 레포 제한, 결과 수 제한
ash preview backend-architect            # 변환될 SKILL.md 미리보기 (설치 안 함)
ash install backend-architect            # ~/.claude/skills/backend-architect/SKILL.md 로 설치
ash install security-auditor --project   # ./.claude/skills/ 로 설치
ash install lst97/claude-code-sub-agents:agents/security/security-auditor.md --prefix gh
ash install backend-architect --grant-tools   # tools 를 allowed-tools 로 내보냄 (신뢰 소스에만)
ash list                                 # 설치된 스킬
ash remove backend-architect             # 제거
ash sources add owner/repo -g 'agents/**/*.md'
ash serve                                # http://127.0.0.1:4747 대시보드
```

같은 이름의 에이전트가 여러 레포에 있으면 `repo:path` 형식으로 지정하라고 후보 목록을 알려줍니다.

설치 후 Claude Code에서는 `/<skill-name>` 으로 호출하거나, 스킬 `description`에 맞는 요청을 하면 자동으로 로드됩니다.

## 변환 규칙

| 에이전트 (입력) | 스킬 (출력) |
|---|---|
| `name` | 소문자·숫자·하이픈 64자 이내로 정규화 (`--prefix` 적용 가능) |
| `description` | `<example>` 블록 제거, 공백 정리, 1024자 제한 |
| `tools` | 기본은 `metadata.preferred-tools` 와 본문의 "Preferred tools" 줄. `--grant-tools` 를 주면 `allowed-tools` 로 출력 |
| `model`, 출처 | `metadata` (`source-repo`, `source-path`, `source-ref`=커밋 SHA, `original-name`, `model`) |
| 본문(시스템 프롬프트) | `# 제목` + 역할 채택 안내 + `## Role and instructions` 아래 원문 |

스킬의 `allowed-tools` 는 "권한 확인 없이 사용 가능"을 뜻하므로, 서브에이전트의 `tools`(사용 제한)를 그대로 옮기지 않습니다.
카탈로그 갱신 시 브랜치를 커밋 SHA 로 고정하므로 미리보기와 설치가 같은 내용을 가리킵니다.

## 대시보드

`ash serve` 는 외부 의존성 없는 단일 HTML 페이지를 루프백 주소에만 바인딩합니다(다른 호스트는 거부).
검색, 레포 필터, 미리보기, 전역/프로젝트 설치, 제거, 소스 추가·삭제를 지원합니다.
JSON API는 모두 `{ success, data | error }` 형식입니다.

보안: 다른 웹사이트가 브라우저를 통해 이 API 를 호출하지 못하도록 Host/Origin 검사, `application/json` Content-Type 강제,
페이지에 심은 프로세스별 토큰(`X-Ash-Token` 헤더)을 요구합니다. 요청 본문은 64KB 로 제한됩니다.

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/catalog?q=&repo=&category=` | 검색 |
| GET | `/api/preview?entryId=` | SKILL.md 미리보기 |
| GET | `/api/installed` | 설치 목록 |
| GET/POST/DELETE | `/api/sources` | 소스 관리 |
| POST | `/api/update` | 카탈로그 갱신 |
| POST | `/api/install`, `/api/uninstall` | 설치/제거 |

## 환경 변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `GITHUB_TOKEN` | 없음 | GitHub API 인증 |
| `ASH_DATA_DIR` | `~/.agent-skill-hub` | 카탈로그·소스·설치 기록 |
| `ASH_GLOBAL_SKILLS_DIR` | `~/.claude/skills` | 전역 스킬 설치 위치 |
| `CLAUDE_CONFIG_DIR` | `~/.claude` | Claude 설정 디렉터리 |

## 개발

```bash
npm test               # vitest (83개 테스트)
npm run test:coverage  # 커버리지 (현재 약 98%, 기준 80%)
npm run typecheck
npm run dev -- search react
```

구조: `src/core` (파싱·변환) → `src/github` (API) → `src/catalog` (인덱스·검색) → `src/install` → `src/service/hub.ts` (CLI/서버 공용 서비스) → `src/commands`, `src/server`.

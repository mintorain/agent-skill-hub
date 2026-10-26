export const DASHBOARD_STYLES = `
  :root { --bg:#0f1115; --panel:#171a21; --line:#262b35; --text:#e6e8ee; --muted:#8b93a7; --accent:#7c9cff; --ok:#3ddc97; }
  * { box-sizing:border-box } body { margin:0; background:var(--bg); color:var(--text); font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif }
  header { display:flex; gap:12px; align-items:center; padding:14px 20px; border-bottom:1px solid var(--line); position:sticky; top:0; background:var(--bg); z-index:2; flex-wrap:wrap }
  header h1 { font-size:16px; margin:0 12px 0 0 } header input { flex:1; min-width:200px; max-width:520px; padding:8px 12px; border-radius:8px; border:1px solid var(--line); background:var(--panel); color:var(--text) }
  header select, button, aside input { padding:8px 12px; border-radius:8px; border:1px solid var(--line); background:var(--panel); color:var(--text); cursor:pointer }
  aside input { cursor:text; flex:1 }
  button.primary { background:var(--accent); border-color:var(--accent); color:#0b0e14; font-weight:600 }
  button:disabled { opacity:.5; cursor:default }
  main { display:grid; grid-template-columns: 1fr 380px; min-height:calc(100vh - 57px) }
  #list { padding:16px 20px; display:grid; gap:10px; align-content:start }
  .card { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:12px 14px; display:grid; grid-template-columns:1fr auto; gap:6px 12px }
  .card h3 { margin:0; font-size:14px } .meta { color:var(--muted); font-size:12px } .card p { margin:4px 0 0; grid-column:1/-1; color:#c5cad6 }
  .tag { display:inline-block; font-size:11px; padding:1px 6px; border-radius:999px; border:1px solid var(--line); color:var(--muted); margin-right:4px }
  .tag.installed { color:var(--ok); border-color:var(--ok) }
  aside { border-left:1px solid var(--line); padding:16px; background:#12151b; position:sticky; top:57px; height:calc(100vh - 57px); overflow:auto }
  aside h2 { font-size:13px; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); margin:0 0 8px }
  aside section { margin-bottom:22px } aside li { display:flex; justify-content:space-between; gap:8px; padding:6px 0; border-bottom:1px solid var(--line); font-size:13px } aside ul { list-style:none; padding:0; margin:0 }
  aside a { color:var(--accent) } #addSource { display:flex; gap:6px; margin-top:8px }
  pre { background:#0b0e14; border:1px solid var(--line); border-radius:8px; padding:10px; max-height:360px; overflow:auto; font-size:12px; white-space:pre-wrap }
  #status { color:var(--muted); font-size:12px; margin-left:auto }
  @media (max-width: 900px) { main { grid-template-columns:1fr } aside { position:static; height:auto; border-left:0; border-top:1px solid var(--line) } }
`

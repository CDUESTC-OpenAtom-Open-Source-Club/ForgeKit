const header = document.querySelector('.site-header');
const currentPage = window.location.pathname.split('/').pop() || 'index.html';
const currentSection = currentPage === 'docker-copy-failed.html'
  ? 'docker-build-failed.html'
  : currentPage;
const globalLinks = [
  ['index.html', './', '首页'],
  ['docker-build-failed.html', './docker-build-failed.html', '构建诊断'],
  ['docker-preflight-check.html', './docker-preflight-check.html', '构建检查'],
  ['mcp-docker-build.html', './mcp-docker-build.html', 'MCP 接入'],
  ['harmonyos-release-readiness.html', './harmonyos-release-readiness.html', '发布准备'],
  ['interview.html', './interview.html', '参与研究'],
];

let navigation = header?.querySelector('.site-nav');
if (header && !navigation) {
  navigation = document.createElement('nav');
  navigation.className = 'site-nav';
  header.appendChild(navigation);
}
if (navigation) {
  navigation.id = 'site-nav';
  navigation.removeAttribute('style');
  navigation.setAttribute('aria-label', '全站导航');
  navigation.replaceChildren(...globalLinks.map(([page, href, label]) => {
    const link = document.createElement('a');
    link.href = href;
    link.textContent = label;
    if (currentSection === page) link.setAttribute('aria-current', 'page');
    return link;
  }));
  const github = document.createElement('a');
  github.href = 'https://github.com/CDUESTC-OpenAtom-Open-Source-Club/ForgeKit';
  github.className = 'nav-action';
  github.textContent = 'GitHub';
  navigation.appendChild(github);
}

let menuButton = header?.querySelector('.menu-button');
if (header && !menuButton) {
  menuButton = document.createElement('button');
  menuButton.className = 'menu-button';
  menuButton.type = 'button';
  menuButton.innerHTML = '<span>菜单</span>';
  header.insertBefore(menuButton, navigation || null);
}
menuButton?.setAttribute('aria-expanded', 'false');
menuButton?.setAttribute('aria-controls', 'site-nav');

const pageSections = {
  'index.html': [['start', '快速上手'], ['workflow', '工作流程'], ['learn', '学习路径'], ['limits', '支持范围']],
  'docker-build-failed.html': [['triage', '排查顺序'], ['example', '诊断示例'], ['try', '开始试用']],
  'docker-copy-failed.html': [['checks', '三处检查'], ['example', '最小示例']],
  'docker-preflight-check.html': [['checks', '检查项目'], ['result', '结果边界']],
  'mcp-docker-build.html': [['install', '接入配置'], ['flow', '完整流程']],
  'harmonyos-release-readiness.html': [['boundary', '能力边界'], ['checklist', '准备清单']],
};
const localSections = pageSections[currentPage];
if (header && localSections) {
  document.querySelector('.page-nav')?.remove();
  const pageNav = document.createElement('nav');
  pageNav.className = 'page-nav';
  pageNav.setAttribute('aria-label', '本页目录');
  const inner = document.createElement('div');
  inner.className = 'page-nav-inner';
  const label = document.createElement('span');
  label.className = 'page-nav-label';
  label.textContent = '本页';
  inner.appendChild(label);
  for (const [id, text] of localSections) {
    const link = document.createElement('a');
    link.href = `#${id}`;
    link.textContent = text;
    if (window.location.hash === `#${id}`) link.setAttribute('aria-current', 'location');
    inner.appendChild(link);
  }
  pageNav.appendChild(inner);
  header.insertAdjacentElement('afterend', pageNav);
}

menuButton?.addEventListener('click', () => {
  const expanded = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!expanded));
  navigation?.classList.toggle('is-open', !expanded);
});

navigation?.addEventListener('click', (event) => {
  if (event.target instanceof HTMLAnchorElement) {
    menuButton?.setAttribute('aria-expanded', 'false');
    navigation.classList.remove('is-open');
  }
});

document.querySelector('.page-nav')?.addEventListener('click', (event) => {
  if (!(event.target instanceof HTMLAnchorElement)) return;
  document.querySelectorAll('.page-nav a').forEach((link) => link.removeAttribute('aria-current'));
  event.target.setAttribute('aria-current', 'location');
});

document.querySelectorAll('.copy-button').forEach((button) => {
  button.addEventListener('click', async () => {
    const targetId = button.getAttribute('data-copy-target');
    const target = targetId ? document.getElementById(targetId) : null;
    if (!target) return;

    const original = button.textContent;
    try {
      await copyText(target.textContent || '');
      button.textContent = '已复制';
      button.dataset.copyState = 'success';
    } catch {
      button.textContent = '请手动复制';
      button.dataset.copyState = 'failed';
    }
    window.setTimeout(() => {
      button.textContent = original;
      delete button.dataset.copyState;
    }, 5000);
  });
});

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Some embedded or permission-restricted browsers block Clipboard API.
      // Fall through to the user-gesture-bound legacy copy path.
    }
  }

  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.appendChild(field);
  field.select();
  const copied = document.execCommand('copy');
  field.remove();
  if (!copied) throw new Error('copy unavailable');
}

// Privacy-preserving attribution: propagate only a public source ID already
// present in the URL. No cookies, storage, fingerprints, IPs, or hidden events.
const query = new URLSearchParams(window.location.search);
const sourceId = query.get('source_id');
if (sourceId && /^[a-z0-9_-]{1,64}$/i.test(sourceId)) {
  document.querySelectorAll('[data-attributed-issue]').forEach((link) => {
    if (!(link instanceof HTMLAnchorElement)) return;
    const url = new URL(link.href);
    url.searchParams.set('title', `${link.dataset.issuePrefix || '试点反馈'}：[source:${sourceId}] `);
    link.href = url.toString();
  });
  const display = document.querySelector('[data-source-display]');
  if (display) display.textContent = `本次来源标识：${sourceId}（可在提交前删除）`;
}

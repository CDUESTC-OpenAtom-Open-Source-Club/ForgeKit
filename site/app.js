const menuButton = document.querySelector('.menu-button');
const navigation = document.querySelector('.site-nav');

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

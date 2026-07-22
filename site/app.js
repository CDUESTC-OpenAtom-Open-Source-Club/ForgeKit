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
      await navigator.clipboard.writeText(target.textContent || '');
      button.textContent = '已复制';
    } catch {
      button.textContent = '请手动复制';
    }
    window.setTimeout(() => { button.textContent = original; }, 1800);
  });
});

(() => {
  const LANGS = {
    ru: { label: '🇷🇺 Rus tili', placeholder: 'Напишите сообщение...' },
    de: { label: '🇩🇪 Nemis tili', placeholder: 'Schreib eine Nachricht...' },
  };
  // Til tanlangach ustoz o'zi gap boshlashi uchun yuboriladigan (ko'rinmaydigan) xabar.
  const STARTER = 'Salom! Men boshlovchiman, keling suhbatni boshlaymiz.';
  const STORAGE_KEY = 'til-ustoz-v1';

  const $ = (id) => document.getElementById(id);
  const welcome = $('welcome');
  const chat = $('chat');
  const chatActions = $('chatActions');
  const langBadge = $('langBadge');
  const messagesEl = $('messages');
  const form = $('composer');
  const input = $('input');
  const sendBtn = $('sendBtn');

  // { lang: 'ru' | 'de' | null, history: [{ role, content, hidden? }] }
  let state = load();
  let busy = false;

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && LANGS[saved.lang] && Array.isArray(saved.history)) return saved;
    } catch {}
    return { lang: null, history: [] };
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  // Faqat **qalin** va *kursiv* belgilarini HTML'ga aylantiradi, qolgani oddiy matn.
  function format(text) {
    return escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  }

  function scrollDown() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function addBubble(role, content) {
    const div = document.createElement('div');
    div.className = `msg ${role === 'user' ? 'user' : 'tutor'}`;
    div.innerHTML = format(content);
    messagesEl.appendChild(div);
    scrollDown();
    return div;
  }

  function showTyping() {
    const div = document.createElement('div');
    div.className = 'msg tutor';
    div.innerHTML = '<span class="typing" aria-label="Ustoz yozmoqda"><span></span><span></span><span></span></span>';
    messagesEl.appendChild(div);
    scrollDown();
    return div;
  }

  function showError(text) {
    const div = document.createElement('div');
    div.className = 'msg error';
    div.textContent = text;
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = 'Qayta urinish';
    retry.onclick = () => {
      div.remove();
      requestReply();
    };
    div.appendChild(retry);
    messagesEl.appendChild(div);
    scrollDown();
  }

  function setBusy(value) {
    busy = value;
    sendBtn.disabled = value;
  }

  function render() {
    const inChat = Boolean(state.lang);
    welcome.hidden = inChat;
    chat.hidden = !inChat;
    chatActions.hidden = !inChat;
    messagesEl.innerHTML = '';
    if (!inChat) return;
    langBadge.textContent = LANGS[state.lang].label;
    input.placeholder = LANGS[state.lang].placeholder;
    for (const m of state.history) {
      if (!m.hidden) addBubble(m.role, m.content);
    }
  }

  async function requestReply() {
    if (busy) return;
    setBusy(true);
    const typing = showTyping();
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lang: state.lang,
          messages: state.history.map(({ role, content }) => ({ role, content })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      typing.remove();
      if (!res.ok || !data.reply) {
        showError(data.error || "Javob kelmadi. Internetni tekshirib, qayta urinib ko'ring.");
        return;
      }
      state.history.push({ role: 'assistant', content: data.reply });
      save();
      addBubble('assistant', data.reply);
    } catch {
      typing.remove();
      showError("Internet bilan aloqa yo'q. Qayta urinib ko'ring.");
    } finally {
      setBusy(false);
    }
  }

  function startChat(lang) {
    state = { lang, history: [{ role: 'user', content: STARTER, hidden: true }] };
    save();
    render();
    requestReply();
  }

  function autoGrow() {
    input.style.height = 'auto';
    input.style.height = `${input.scrollHeight}px`;
  }

  document.querySelectorAll('.lang-card').forEach((btn) => {
    btn.addEventListener('click', () => startChat(btn.dataset.lang));
  });

  $('newChatBtn').addEventListener('click', () => {
    if (busy) return;
    if (confirm('Suhbatni yangidan boshlaymizmi?')) startChat(state.lang);
  });

  $('changeLangBtn').addEventListener('click', () => {
    if (busy) return;
    state = { lang: null, history: [] };
    save();
    render();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || busy) return;
    // Oldingi urinishdagi xato xabarini olib tashlaymiz.
    messagesEl.querySelectorAll('.msg.error').forEach((el) => el.remove());
    state.history.push({ role: 'user', content: text });
    save();
    addBubble('user', text);
    input.value = '';
    autoGrow();
    requestReply();
  });

  input.addEventListener('input', autoGrow);
  input.addEventListener('keydown', (e) => {
    // Kompyuterda Enter yuboradi, Shift+Enter yangi qator qo'shadi.
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && window.matchMedia('(pointer: fine)').matches) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  render();
  // Oxirgi xabar foydalanuvchiniki bo'lsa (javob kelmay qolgan), javobni qayta so'raymiz.
  const last = state.history[state.history.length - 1];
  if (state.lang && last && last.role === 'user') requestReply();
})();

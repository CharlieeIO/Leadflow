;(function () {
  'use strict'

  // ── Config ──────────────────────────────────────────────────────────────────
  var script = document.currentScript ||
    (function () {
      var scripts = document.getElementsByTagName('script')
      return scripts[scripts.length - 1]
    })()

  var BUSINESS_ID = script.getAttribute('data-business-id')
  var BASE_URL    = script.getAttribute('data-base-url') || 'https://app.leadflow.ai'
  var ACCENT      = script.getAttribute('data-color')    || '#2563eb'
  var TITLE       = script.getAttribute('data-title')    || 'Chat with us'
  var SUBTITLE    = script.getAttribute('data-subtitle') || 'We usually reply in seconds'
  var STORAGE_KEY = 'lf_' + BUSINESS_ID

  if (!BUSINESS_ID) return // silently bail if not configured

  // ── Persistent state ────────────────────────────────────────────────────────
  function loadState() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || {} }
    catch (e) { return {} }
  }
  function saveState(s) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch (e) {}
  }

  var state = loadState() // { lead_id?, name?, open? }

  // ── Styles ───────────────────────────────────────────────────────────────────
  var css = '\n' +
    '#lf-widget * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; padding: 0; }\n' +
    '#lf-btn { position: fixed; bottom: 24px; right: 24px; width: 56px; height: 56px; border-radius: 50%; background: ACCENT; border: none; cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,.25); display: flex; align-items: center; justify-content: center; z-index: 2147483646; transition: transform .15s; }\n' +
    '#lf-btn:hover { transform: scale(1.08); }\n' +
    '#lf-btn svg { width: 26px; height: 26px; fill: white; }\n' +
    '#lf-badge { position: absolute; top: -3px; right: -3px; width: 16px; height: 16px; background: #ef4444; border-radius: 50%; border: 2px solid white; display: none; }\n' +
    '#lf-panel { position: fixed; bottom: 92px; right: 24px; width: 360px; max-height: 560px; background: white; border-radius: 16px; box-shadow: 0 8px 40px rgba(0,0,0,.18); display: flex; flex-direction: column; z-index: 2147483645; overflow: hidden; transform: scale(.92) translateY(12px); opacity: 0; pointer-events: none; transition: transform .2s, opacity .2s; }\n' +
    '#lf-panel.lf-open { transform: scale(1) translateY(0); opacity: 1; pointer-events: all; }\n' +
    '@media (max-width: 420px) { #lf-panel { width: calc(100vw - 24px); right: 12px; bottom: 80px; } #lf-btn { right: 12px; bottom: 16px; } }\n' +
    '#lf-header { background: ACCENT; padding: 16px 18px; color: white; }\n' +
    '#lf-header h3 { font-size: 15px; font-weight: 600; }\n' +
    '#lf-header p  { font-size: 12px; opacity: .82; margin-top: 2px; }\n' +
    '#lf-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; min-height: 160px; max-height: 320px; }\n' +
    '.lf-msg { max-width: 80%; padding: 10px 13px; border-radius: 14px; font-size: 14px; line-height: 1.45; word-break: break-word; }\n' +
    '.lf-msg.lf-in  { background: #f1f5f9; color: #1e293b; align-self: flex-start; border-bottom-left-radius: 4px; }\n' +
    '.lf-msg.lf-out { background: ACCENT; color: white; align-self: flex-end; border-bottom-right-radius: 4px; }\n' +
    '.lf-typing { display: flex; gap: 4px; align-items: center; padding: 10px 13px; background: #f1f5f9; border-radius: 14px; border-bottom-left-radius: 4px; width: fit-content; }\n' +
    '.lf-dot { width: 7px; height: 7px; background: #94a3b8; border-radius: 50%; animation: lf-bounce .9s infinite; }\n' +
    '.lf-dot:nth-child(2) { animation-delay: .15s; } .lf-dot:nth-child(3) { animation-delay: .3s; }\n' +
    '@keyframes lf-bounce { 0%,60%,100% { transform: translateY(0); } 30% { transform: translateY(-5px); } }\n' +
    '#lf-intake { padding: 18px; border-top: 1px solid #f1f5f9; display: flex; flex-direction: column; gap: 10px; }\n' +
    '#lf-intake input { width: 100%; padding: 9px 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; color: #0f172a; outline: none; transition: border-color .15s; }\n' +
    '#lf-intake input:focus { border-color: ACCENT; box-shadow: 0 0 0 3px ACCENT22; }\n' +
    '#lf-intake textarea { width: 100%; padding: 9px 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; color: #0f172a; outline: none; resize: none; height: 72px; transition: border-color .15s; }\n' +
    '#lf-intake textarea:focus { border-color: ACCENT; box-shadow: 0 0 0 3px ACCENT22; }\n' +
    '#lf-intake button { width: 100%; padding: 10px; background: ACCENT; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: opacity .15s; }\n' +
    '#lf-intake button:disabled { opacity: .55; cursor: default; }\n' +
    '#lf-intake .lf-err { font-size: 12px; color: #ef4444; }\n' +
    '#lf-composer { padding: 12px; border-top: 1px solid #f1f5f9; display: flex; gap: 8px; }\n' +
    '#lf-composer textarea { flex: 1; padding: 9px 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; color: #0f172a; outline: none; resize: none; height: 42px; max-height: 120px; overflow-y: auto; transition: border-color .15s; }\n' +
    '#lf-composer textarea:focus { border-color: ACCENT; }\n' +
    '#lf-composer button { width: 38px; height: 38px; border-radius: 8px; background: ACCENT; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: opacity .15s; align-self: flex-end; }\n' +
    '#lf-composer button:disabled { opacity: .45; cursor: default; }\n' +
    '#lf-composer button svg { width: 18px; height: 18px; fill: white; }\n' +
    '#lf-branding { text-align: center; font-size: 11px; color: #94a3b8; padding: 6px; }\n' +
    '#lf-branding a { color: #94a3b8; text-decoration: none; }\n'

  // replace ACCENT and ACCENT22 placeholders
  var accentHex = ACCENT.replace('#', '')
  css = css.replace(/ACCENT22/g, '#' + accentHex + '22').replace(/ACCENT/g, ACCENT)

  var styleEl = document.createElement('style')
  styleEl.textContent = css
  document.head.appendChild(styleEl)

  // ── HTML ─────────────────────────────────────────────────────────────────────
  var wrapper = document.createElement('div')
  wrapper.id = 'lf-widget'
  wrapper.innerHTML =
    '<button id="lf-btn" aria-label="Open chat">' +
      '<span id="lf-badge"></span>' +
      '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>' +
    '</button>' +
    '<div id="lf-panel" role="dialog" aria-label="Chat">' +
      '<div id="lf-header"><h3>' + esc(TITLE) + '</h3><p>' + esc(SUBTITLE) + '</p></div>' +
      '<div id="lf-messages"></div>' +
      '<div id="lf-intake">' +
        '<input id="lf-name"  type="text"  placeholder="Your name" autocomplete="name" />' +
        '<input id="lf-phone" type="tel"   placeholder="Phone number" autocomplete="tel" />' +
        '<textarea id="lf-init-msg" placeholder="How can we help you?"></textarea>' +
        '<div id="lf-err" class="lf-err"></div>' +
        '<button id="lf-start-btn">Start chat</button>' +
      '</div>' +
      '<div id="lf-composer" style="display:none">' +
        '<textarea id="lf-input" placeholder="Type a message…" rows="1"></textarea>' +
        '<button id="lf-send-btn" aria-label="Send">' +
          '<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>' +
        '</button>' +
      '</div>' +
      '<div id="lf-branding"><a href="https://leadflow.ai" target="_blank" rel="noopener">Powered by LeadFlow</a></div>' +
    '</div>'

  document.body.appendChild(wrapper)

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function esc(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
  }

  function el(id) { return document.getElementById(id) }

  function addMessage(text, type) { // type: 'in' | 'out'
    var msgs = el('lf-messages')
    var div = document.createElement('div')
    div.className = 'lf-msg lf-' + type
    div.textContent = text
    msgs.appendChild(div)
    msgs.scrollTop = msgs.scrollHeight
    return div
  }

  function showTyping() {
    var msgs = el('lf-messages')
    var div = document.createElement('div')
    div.className = 'lf-typing'
    div.id = 'lf-typing'
    div.innerHTML = '<div class="lf-dot"></div><div class="lf-dot"></div><div class="lf-dot"></div>'
    msgs.appendChild(div)
    msgs.scrollTop = msgs.scrollHeight
  }

  function hideTyping() {
    var t = el('lf-typing')
    if (t) t.remove()
  }

  function setIntakeVisible(v) {
    el('lf-intake').style.display   = v ? '' : 'none'
    el('lf-composer').style.display = v ? 'none' : ''
  }

  // ── Toggle panel ─────────────────────────────────────────────────────────────
  var panelOpen = !!state.open

  function openPanel() {
    panelOpen = true
    el('lf-panel').classList.add('lf-open')
    el('lf-badge').style.display = 'none'
    state.open = true
    saveState(state)
    if (state.lead_id) {
      setIntakeVisible(false)
      el('lf-input').focus()
    } else {
      el('lf-name').focus()
    }
  }

  function closePanel() {
    panelOpen = false
    el('lf-panel').classList.remove('lf-open')
    state.open = false
    saveState(state)
  }

  el('lf-btn').addEventListener('click', function () {
    if (panelOpen) closePanel(); else openPanel()
  })

  // Close on Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && panelOpen) closePanel()
  })

  // ── Restore returning visitor ────────────────────────────────────────────────
  if (state.lead_id) {
    setIntakeVisible(false)
    if (state.open) openPanel()
  }

  // ── Intake form submit ────────────────────────────────────────────────────────
  el('lf-start-btn').addEventListener('click', submitIntake)
  el('lf-init-msg').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitIntake() }
  })

  function submitIntake() {
    var name    = el('lf-name').value.trim()
    var phone   = el('lf-phone').value.trim()
    var message = el('lf-init-msg').value.trim()
    var errEl   = el('lf-err')

    errEl.textContent = ''

    if (!phone) { errEl.textContent = 'Please enter your phone number.'; return }
    if (!message) { errEl.textContent = 'Please tell us how we can help.'; return }

    el('lf-start-btn').disabled = true
    el('lf-start-btn').textContent = 'Starting…'

    fetch(BASE_URL + '/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business_id: BUSINESS_ID,
        name: name || undefined,
        phone: phone,
        message: message,
        source: 'chat_widget',
      }),
    })
    .then(function (r) { return r.json() })
    .then(function (d) {
      if (!d.lead_id) throw new Error(d.error || 'Failed to start chat')

      state.lead_id = d.lead_id
      saveState(state)

      setIntakeVisible(false)
      if (name) addMessage('Hi ' + esc(name) + '!', 'in')
      addMessage(message, 'out')
      showTyping()

      // Get first AI response
      return fetch(BASE_URL + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: BUSINESS_ID, lead_id: d.lead_id, message: message }),
      })
      .then(function (r) { return r.json() })
    })
    .then(function (d) {
      hideTyping()
      if (d.message) addMessage(d.message, 'in')
      el('lf-input').focus()
    })
    .catch(function (err) {
      hideTyping()
      el('lf-start-btn').disabled = false
      el('lf-start-btn').textContent = 'Start chat'
      errEl.textContent = err.message || 'Something went wrong. Please try again.'
    })
  }

  // ── Composer send ─────────────────────────────────────────────────────────────
  el('lf-send-btn').addEventListener('click', sendMessage)
  el('lf-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  })

  // Auto-resize textarea
  el('lf-input').addEventListener('input', function () {
    this.style.height = 'auto'
    this.style.height = Math.min(this.scrollHeight, 120) + 'px'
  })

  function sendMessage() {
    var text = el('lf-input').value.trim()
    if (!text || !state.lead_id) return

    el('lf-input').value = ''
    el('lf-input').style.height = ''
    el('lf-send-btn').disabled = true
    addMessage(text, 'out')
    showTyping()

    fetch(BASE_URL + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_id: BUSINESS_ID, lead_id: state.lead_id, message: text }),
    })
    .then(function (r) { return r.json() })
    .then(function (d) {
      hideTyping()
      if (d.message) addMessage(d.message, 'in')
    })
    .catch(function () {
      hideTyping()
      addMessage("Sorry, something went wrong. Please try again.", 'in')
    })
    .finally(function () {
      el('lf-send-btn').disabled = false
      el('lf-input').focus()
    })
  }

  // ── Badge on first load (if not opened yet) ───────────────────────────────────
  if (!state.lead_id && !state.open) {
    setTimeout(function () {
      if (!panelOpen) el('lf-badge').style.display = 'block'
    }, 3000)
  }
})()

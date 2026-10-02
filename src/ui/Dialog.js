export class Dialog {
  async show({ title, message, fields = [], buttons = [{ label: 'Cancel', value: null }, { label: 'OK', value: 'ok', default: true }], content }) {
    if (document.querySelector('dialog[open]')) return null;
    const dialog = document.createElement('dialog');
    dialog.setAttribute('aria-modal', 'true');
    const root = document.getElementById('app') || document.body;
    const previousFocus = document.activeElement;
    const siblings = [...root.children].map(el => [el, el.inert]);
    siblings.forEach(([el]) => { el.inert = true; });
    const backdrop = document.createElement('div'); backdrop.className = 'modal-backdrop'; root.append(backdrop);
    const heading = document.createElement('h2'); heading.textContent = title; heading.id = 'dialog-title'; dialog.setAttribute('aria-labelledby', heading.id); dialog.append(heading);
    if (message) { const p = document.createElement('p'); p.textContent = message; dialog.append(p); }
    const form = document.createElement('form'); form.className = 'dialog-form';
    const inputs = new Map();
    fields.forEach(field => {
      const label = document.createElement('label'); label.className = 'dialog-field';
      const text = document.createElement('span'); text.textContent = field.label; label.append(text);
      const input = document.createElement(field.options ? 'select' : 'input');
      if (field.options) field.options.forEach(option => { const el = document.createElement('option'); el.value = option.value ?? option; el.textContent = option.label ?? option; input.append(el); });
      else { input.type = field.type || 'text'; if (field.min !== undefined) input.min = field.min; if (field.max !== undefined) input.max = field.max; if (field.step !== undefined) input.step = field.step; }
      input.value = field.value; input.required = field.required !== false; input.name = field.name;
      label.append(input); form.append(label); inputs.set(field.name, input);
    });
    if (content) form.append(content);
    const row = document.createElement('div'); row.className = 'dialog-buttons';
    let finish;
    const result = new Promise(resolve => { finish = value => { dialog.remove(); backdrop.remove(); siblings.forEach(([el, inert]) => { el.inert = inert; }); previousFocus?.focus({ preventScroll: true }); resolve(value); }; });
    const values = () => Object.fromEntries([...inputs].map(([name, input]) => [name, input.type === 'number' ? input.valueAsNumber : input.value]));
    buttons.forEach(button => {
      const el = document.createElement('button'); el.type = button.default ? 'submit' : 'button'; el.className = `mac-button${button.default ? ' default' : ''}`; el.textContent = button.label;
      if (!button.default) el.addEventListener('click', () => finish(button.value === null ? null : { action: button.value, ...values() }));
      row.append(el);
    });
    form.addEventListener('submit', e => { e.preventDefault(); if (form.reportValidity()) finish({ action: buttons.find(b => b.default)?.value || 'ok', ...values() }); });
    dialog.addEventListener('cancel', e => { e.preventDefault(); finish(null); });
    dialog.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); finish(null); }
      if (e.key === 'Tab') {
        const focusable = [...dialog.querySelectorAll('input, select, button')].filter(el => !el.disabled);
        const first = focusable[0], last = focusable.at(-1);
        if ((e.shiftKey && document.activeElement === first) || (!e.shiftKey && document.activeElement === last)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
      }
    });
    form.append(row); dialog.append(form); backdrop.append(dialog); dialog.setAttribute('open', '');
    const first = inputs.size ? inputs.values().next().value : row.querySelector('button.default') || row.querySelector('button');
    first.focus();
    if (first.tagName === 'INPUT' && first.type === 'text') first.select();
    return result;
  }
  alert(title, message) { return this.show({ title, message, buttons: [{ label: 'OK', value: 'ok', default: true }] }); }
}

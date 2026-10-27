import { escapeHTML as e, type Settings } from './shared';
import type { StoryUI } from './story-ui';

/** Feature preferences live with their feature, separate from connection setup. */
export function renderFeatureControls(body: HTMLElement, ui: StoryUI, feature: 'commentary' | 'naming', draft: Partial<Settings>, onDraft: (draft: Partial<Settings>) => void) {
  const s = { ...ui.view().state.settings, ...draft }, commentary = feature === 'commentary';
  const check = (key: string, label: string, enabled: boolean) => `<label class="check feature-toggle"><span>${label}</span><input class="${key}" type="checkbox" role="switch" ${enabled ? 'checked' : ''}></label>`;
  body.innerHTML = `<div class="section-head"><h2>${commentary ? 'Commentary' : 'Chat naming'}</h2></div><form class="feature-form">${commentary ? `
    ${check('commentary-enabled', 'Let Kazz comment', s.commentaryEnabled)}
    <p class="muted">A short aside from his widget. Never added to the roleplay.</p>
    <label class="field">Comment every <output class="interval-value">${s.commentaryInterval}</output> new messages / swipes<input class="commentary-interval" type="range" min="1" max="50" value="${s.commentaryInterval}"></label>
    <fieldset><legend>Keep the bubble</legend><div class="segments">${[[14, 'Timed'], [0, 'Until closed']].map(([n, label]) => `<button type="button" data-duration="${n}" aria-pressed="${(n === 0) === (s.commentaryDuration === 0)}">${label}</button>`).join('')}</div><label class="field duration-field" ${s.commentaryDuration === 0 ? 'hidden' : ''}>Seconds<input class="commentary-duration" type="number" min="3" max="120" value="${s.commentaryDuration || 14}" ${s.commentaryDuration === 0 ? 'disabled' : ''} required></label></fieldset>
    <fieldset><legend>Bubble size</legend><div class="segments">${[[220, 'Small'], [280, 'Medium'], [360, 'Large']].map(([n, label]) => `<button type="button" data-width="${n}" aria-pressed="${s.commentaryWidth === n}">${label}</button>`).join('')}</div><div class="bubble-preview" style="--preview-width:${s.commentaryWidth}px"><b>Kazz</b>That door is absolutely somebody’s problem.</div></fieldset>
    <p class="muted">New swipes count once. Uses Kazz’s connection.</p>
    ` : `
    ${check('auto-name', 'Name this chat automatically', s.autoName)}
    <p class="muted">A searchable title that follows the story.</p>
    <label class="field">Rename every <output class="interval-value">${s.nameInterval}</output> new messages<input class="name-interval" type="range" min="10" max="50" value="${s.nameInterval}"></label>
    <p class="muted">First title on the next new message. Swipes don’t advance the count. Existing titles can be replaced; Undo is below.</p>
    `}<button class="primary ${commentary ? 'save-commentary' : 'save-naming'}" data-mutate>Save preferences</button></form>`;
  let duration = s.commentaryDuration, width = s.commentaryWidth;
  const read = (): Partial<Settings> => commentary ? {
    commentaryEnabled: body.querySelector<HTMLInputElement>('.commentary-enabled')!.checked,
    commentaryInterval: Number(body.querySelector<HTMLInputElement>('.commentary-interval')!.value),
    commentaryDuration: duration === 0 ? 0 : Number(body.querySelector<HTMLInputElement>('.commentary-duration')!.value), commentaryWidth: width,
  } : { autoName: body.querySelector<HTMLInputElement>('.auto-name')!.checked, nameInterval: Number(body.querySelector<HTMLInputElement>('.name-interval')!.value) };
  body.querySelectorAll('input').forEach(input => input.addEventListener('input', () => {
    const current = read(); onDraft(current);
    body.querySelector('output')!.textContent = String(commentary ? current.commentaryInterval : current.nameInterval);
  }));
  body.querySelectorAll<HTMLButtonElement>('[data-duration]').forEach(button => button.addEventListener('click', () => {
    duration = Number(button.dataset.duration);
    body.querySelector<HTMLElement>('.duration-field')!.hidden = duration === 0;
    body.querySelector<HTMLInputElement>('.commentary-duration')!.disabled = duration === 0;
    body.querySelectorAll<HTMLButtonElement>('[data-duration]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    onDraft(read());
  }));
  body.querySelectorAll<HTMLButtonElement>('[data-width]').forEach(button => button.addEventListener('click', () => {
    width = Number(button.dataset.width);
    body.querySelectorAll<HTMLButtonElement>('[data-width]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    body.querySelector<HTMLElement>('.bubble-preview')!.style.setProperty('--preview-width', `${width}px`);
    onDraft(read());
  }));
  body.querySelector('form')!.addEventListener('submit', event => {
    event.preventDefault(); if (ui.busy()) return;
    const next = { ...ui.view().state.settings, ...read() }; onDraft({});
    void ui.run('settings', { settings: next }, `${commentary ? 'Commentary' : 'Chat naming'} preferences saved for this chat.`);
  });
  if (!commentary) {
    const history = document.createElement('div'); history.className = 'name-history';
    history.innerHTML = `<button class="name-now" data-mutate>Name chat now</button>${[...ui.view().state.story.names].reverse().filter(n => n.status !== 'undone').map(n => `<button data-name-undo="${e(n.id)}" data-mutate>Undo title: ${e(n.after)}</button>`).join('')}`;
    history.querySelector('.name-now')!.addEventListener('click', () => { void ui.run('nameChat', {}, 'Chat renamed. Previous title saved for Undo.'); });
    history.querySelectorAll<HTMLButtonElement>('[data-name-undo]').forEach(button => button.addEventListener('click', () => { void ui.run('undoName', { id: button.dataset.nameUndo }, 'Previous chat title restored.'); }));
    body.append(history);
  }
}

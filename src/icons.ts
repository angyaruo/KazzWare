const paths: Record<string, string> = {
  settings: '<path d="m10 2-.6 3-2 .9-2.6-1.1L2 8.2l2.3 2v2.6l-2.3 2 2.2 3.5 2.9-1 2.2 1.2.7 3.5h4l.7-3.5 2.2-1.2 2.9 1 2.2-3.5-2.3-2v-2.6l2.3-2-2.8-3.4-2.6 1.1-2-.9L14 2Z"/><circle cx="12" cy="12" r="3.5"/>',
  edit: '<path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14Z"/>',
  swipes: '<path d="M4 4v4c0 5 12 3 12 8v4M20 4v4c0 5-12 3-12 8v4M13 17l3 3 3-3"/>',
  slop: '<path d="m15 3 6 6-11 11H5l-3-3Zm-7 7 6 6M10 20h11"/>',
  chat: '<path d="M4 4h16v12H9l-5 4Z"/><path d="M8 8h8M8 12h5"/>',
  gallery: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 5h4M10 19h4M9 10h6M9 13h4"/>',
  timeline: '<path d="M6 3v18M9 5h11M9 12h8M9 19h11"/><circle cx="6" cy="5" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="6" cy="19" r="2"/>',
  notebook: '<path d="M5 3h15v18H5ZM2 7h5M2 12h5M2 17h5M9 8h7M9 12h7"/>',
  naming: '<path d="M3 5h12l7 7-7 7H3Z"/><circle cx="16" cy="12" r="1"/><path d="M6 9v6M6 9h5M6 12h4"/>',
  commentary: '<path d="M3 4h18v12h-7l-5 5v-5H3Z"/><path d="M7 9v3M12 7v6M17 9v3"/>',
};
export function icon(name: string) { return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || ''}</svg>`; }

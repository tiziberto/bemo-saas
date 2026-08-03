import { defineStore } from 'pinia';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ToastKind = 'info' | 'success' | 'error' | 'warning';

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  desc?: string;
}

interface ConfirmRequest {
  title: string;
  desc?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

const THEME_KEY = 'bemo_theme';
const SIDEBAR_KEY = 'bemo_sidebar_collapsed';

function systemPrefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

/** Estado transversal de UI: tema, avisos, confirmaciones, navegación lateral. */
export const useUi = defineStore('ui', {
  state: () => ({
    theme: (localStorage.getItem(THEME_KEY) as ThemeMode) || 'system',
    toasts: [] as Toast[],
    sidebarCollapsed: localStorage.getItem(SIDEBAR_KEY) === '1',
    sidebarOpen: false, // drawer en mobile
    paletteOpen: false,
    confirmState: null as (ConfirmRequest & { resolve: (v: boolean) => void }) | null,
    _seq: 0,
  }),
  getters: {
    isDark: (s) => (s.theme === 'system' ? systemPrefersDark() : s.theme === 'dark'),
  },
  actions: {
    applyTheme() {
      const dark = this.theme === 'system' ? systemPrefersDark() : this.theme === 'dark';
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    },
    setTheme(mode: ThemeMode) {
      this.theme = mode;
      localStorage.setItem(THEME_KEY, mode);
      this.applyTheme();
    },
    toggleTheme() {
      this.setTheme(this.isDark ? 'light' : 'dark');
    },
    initTheme() {
      this.applyTheme();
      window
        .matchMedia?.('(prefers-color-scheme: dark)')
        .addEventListener?.('change', () => {
          if (this.theme === 'system') this.applyTheme();
        });
    },

    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed;
      localStorage.setItem(SIDEBAR_KEY, this.sidebarCollapsed ? '1' : '0');
    },

    toast(kind: ToastKind, title: string, desc?: string) {
      const id = ++this._seq;
      this.toasts.push({ id, kind, title, desc });
      setTimeout(() => this.dismiss(id), kind === 'error' ? 6500 : 4000);
    },
    success(title: string, desc?: string) {
      this.toast('success', title, desc);
    },
    error(title: string, desc?: string) {
      this.toast('error', title, desc);
    },
    info(title: string, desc?: string) {
      this.toast('info', title, desc);
    },
    dismiss(id: number) {
      this.toasts = this.toasts.filter((t) => t.id !== id);
    },

    /** Confirmación modal; resuelve true/false. */
    confirm(req: ConfirmRequest): Promise<boolean> {
      return new Promise((resolve) => {
        this.confirmState = { ...req, resolve };
      });
    },
    resolveConfirm(value: boolean) {
      this.confirmState?.resolve(value);
      this.confirmState = null;
    },
  },
});

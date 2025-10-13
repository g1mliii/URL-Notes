/**
 * Theming and Accent Color Management Module
 */
class ThemeManager {
  constructor() {
    this.themeMode = 'auto'; // 'auto' | 'light' | 'dark'
  }

  // Derive accent color from favicon (with safe fallbacks)
  async applyAccentFromFavicon(currentSite) {
    try {
      const domain = currentSite?.domain;
      const accent = await this.deriveAccentColor(currentSite?.favicon, domain);
      if (!domain) return;
      const cached = await this.getCachedAccent(domain);
      // If accent couldn't be derived, do nothing (keep cached or neutral background)
      if (!accent) return;
      if (!this.isSameAccent(cached, accent)) {
        this.setAccentVariables(accent);
        await this.setCachedAccent(domain, accent);
      }
    } catch (e) {
      // No-op on failure to avoid any flash or unwanted fallback
    }
  }

  async deriveAccentColor(faviconUrl, domain) {
    // If no favicon, do not change colors
    if (!faviconUrl) {
      return null;
    }

    // Attempt to load image with CORS
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const loadPromise = new Promise((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
    });
    img.src = faviconUrl;
    await loadPromise;

    // Draw to canvas and sample pixels
    const size = 24;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    try {
      ctx.drawImage(img, 0, 0, size, size);
      const { data } = ctx.getImageData(0, 0, size, size);
      // Simple average color with slight saturation bias
      let r = 0, g = 0, b = 0, count = 0;
      for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3];
        if (alpha < 16) continue; // ignore transparent
        r += data[i]; g += data[i + 1]; b += data[i + 2];
        count++;
      }
      if (!count) throw new Error('Empty favicon pixels');
      r = Math.round(r / count); g = Math.round(g / count); b = Math.round(b / count);
      // Convert to HSL and normalize to tasteful accent
      const { h, s, l } = this.rgbToHsl(r, g, b);
      // Tune saturation/lightness for better legibility in UI
      const accent = {
        h,
        s: Math.max(0.35, Math.min(0.65, s * 0.9)),
        l: Math.max(0.44, Math.min(0.58, l * 0.95)),
      };
      return accent;
    } catch (err) {
      // Canvas tainted or other error — do not change colors
      return null;
    }
  }

  setAccentVariables(hsl) {
    const root = document.documentElement;
    const primary = `hsl(${Math.round(hsl.h)} ${Math.round(hsl.s * 100)}% ${Math.round(hsl.l * 100)}%)`;
    const secondary = `hsl(${Math.round(hsl.h)} ${Math.round(Math.min(1, hsl.s * 0.9) * 100)}% ${Math.round(Math.max(0, hsl.l - 0.06) * 100)}%)`;
    root.style.setProperty('--accent-primary', primary);
    root.style.setProperty('--accent-secondary', secondary);
  }

  rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: h * 360, s, l };
  }

  // Accent cache helpers
  async getCachedAccent(domain) {
    if (!domain) return null;
    const { accentCache } = await browserAPI.storage.local.get(['accentCache']);
    const cache = accentCache || {};
    const entry = cache[domain];
    if (!entry) return null;
    const { h, s, l } = entry;
    if (typeof h !== 'number' || typeof s !== 'number' || typeof l !== 'number') return null;
    return { h, s, l };
  }

  async setCachedAccent(domain, hsl) {
    if (!domain || !hsl) return;
    const { accentCache } = await browserAPI.storage.local.get(['accentCache']);
    const cache = accentCache || {};
    cache[domain] = { h: hsl.h, s: hsl.s, l: hsl.l, updatedAt: Date.now() };
    await browserAPI.storage.local.set({ accentCache: cache });
  }

  isSameAccent(a, b) {
    if (!a || !b) return false;
    const dh = Math.abs(a.h - b.h);
    const ds = Math.abs(a.s - b.s);
    const dl = Math.abs(a.l - b.l);
    return dh < 1 && ds < 0.01 && dl < 0.01;
  }

  // Detect system theme and manage override (auto/light/dark)
  async setupThemeDetection() {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const root = document.documentElement;

    // Load preference
    const { themeMode } = await browserAPI.storage.local.get(['themeMode']);
    this.themeMode = themeMode || 'auto'; // 'auto' | 'light' | 'dark'

    const updateAuto = () => {
      const isDark = mql.matches;
      root.setAttribute('data-theme', isDark ? 'dark' : 'light');
      this.updateThemeToggleTitle('auto');
    };

    const applyTheme = () => {
      if (this.themeMode === 'auto') {
        updateAuto();
      } else if (this.themeMode === 'light') {
        root.setAttribute('data-theme', 'light');
        this.updateThemeToggleTitle('light');
      } else if (this.themeMode === 'dark') {
        root.setAttribute('data-theme', 'dark');
        this.updateThemeToggleTitle('dark');
      }
    };

    // Listen to system changes only in auto mode
    const onChange = () => {
      if (this.themeMode === 'auto') updateAuto();
    };
    mql.addEventListener('change', onChange);

    // Wire toggle
    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
      btn.addEventListener('click', async () => {
        this.themeMode = this.themeMode === 'auto' ? 'light' : this.themeMode === 'light' ? 'dark' : 'auto';
        await browserAPI.storage.local.set({ themeMode: this.themeMode });
        applyTheme();
      });
    }

    applyTheme();
  }

  updateThemeToggleTitle(mode) {
    const btn = document.getElementById('themeToggleBtn');
    if (!btn) return;
    const map = { auto: 'Theme: Auto', light: 'Theme: Light', dark: 'Theme: Dark' };
    btn.title = map[mode] || 'Theme';
    btn.setAttribute('aria-label', btn.title);
  }
}

// Export for use in other modules
window.ThemeManager = ThemeManager;

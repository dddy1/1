/**
 * 呱呱手机 —— 主入口
 * 负责：
 *   - 读取 / 持久化设置（启用开关、顶掉手机系统状态栏）
 *   - 挂载灵动岛
 *   - 进入/退出全屏壳，按需加载 Vue 并挂载手机 App
 *
 * 详细规划见同目录下 ../../PHONE_PLAN.md
 */
import { settings, saveAllSettings } from '../../index.js';
import { loadVue } from './core/vue-loader.js';
import { mountDynamicIsland, unmountDynamicIsland, setIslandPhoneOpen } from './shell/dynamic-island.js';
import { mountPhoneShell, unmountPhoneShell, isPhoneShellOpen } from './shell/fullscreen.js';
import { createPhoneRoot } from './core/root.js';

let vueApp = null;

export function initPhone() {
    // 默认设置
    if (!settings.phone) {
        settings.phone = {
            enabled: false,
            hideMobileStatusBar: false,
        };
    }

    bindSettingUI();
    applyEnabledState();
}

/**
 * 绑定设置面板里的开关
 */
function bindSettingUI() {
    const enableEl = document.getElementById('ggg-phone-enable');
    const hideStatusEl = document.getElementById('ggg-phone-hide-mobile-status');

    if (enableEl) {
        enableEl.checked = !!settings.phone.enabled;
        enableEl.addEventListener('change', () => {
            settings.phone.enabled = enableEl.checked;
            saveAllSettings();
            applyEnabledState();
        });
    }

    if (hideStatusEl) {
        hideStatusEl.checked = !!settings.phone.hideMobileStatusBar;
        hideStatusEl.addEventListener('change', () => {
            settings.phone.hideMobileStatusBar = hideStatusEl.checked;
            saveAllSettings();
            applyMobileStatusBarPolicy();
        });
    }
}

/**
 * 根据启用开关：挂/卸载灵动岛
 */
function applyEnabledState() {
    if (settings.phone?.enabled) {
        mountDynamicIsland({
            onEnter: enterPhone,
            onExit: exitPhone,
        });
        applyMobileStatusBarPolicy();
    } else {
        if (isPhoneShellOpen()) exitPhone();
        unmountDynamicIsland();
    }
}

/**
 * 让网页贴满整个屏幕（包括手机系统状态栏）
 * 用 viewport meta 的 viewport-fit=cover + theme-color 配合
 * 注意：真正"顶掉"系统状态栏只在 PWA / Android Chrome 沉浸模式下完整生效，
 *       这里尽力而为：写入 viewport-fit=cover 让 CSS env(safe-area-inset-*) 可用
 */
function applyMobileStatusBarPolicy() {
    let vp = document.querySelector('meta[name="viewport"]');
    if (!vp) {
        vp = document.createElement('meta');
        vp.name = 'viewport';
        document.head.appendChild(vp);
    }
    const base = 'width=device-width, initial-scale=1';
    vp.content = settings.phone?.hideMobileStatusBar
        ? `${base}, viewport-fit=cover`
        : base;
}

/**
 * 进入手机
 */
async function enterPhone() {
    if (isPhoneShellOpen()) return;

    // 调用浏览器全屏 API（必须在用户手势内调用，双击灵动岛满足）
    // 这样能干掉浏览器自身的地址栏 / 底部条
    try {
        const docEl = document.documentElement;
        const req = docEl.requestFullscreen
            || docEl.webkitRequestFullscreen
            || docEl.mozRequestFullScreen
            || docEl.msRequestFullscreen;
        if (req && !document.fullscreenElement) {
            await req.call(docEl).catch(() => {});
        }
    } catch (e) { /* 全屏失败不影响其他流程 */ }

    mountPhoneShell();
    setIslandPhoneOpen(true);

    try {
        const Vue = await loadVue();
        const Root = createPhoneRoot(Vue);
        vueApp = Vue.createApp(Root);
        vueApp.mount('#ggg-phone-app-mount');
    } catch (err) {
        const mount = document.getElementById('ggg-phone-app-mount');
        if (mount) {
            mount.innerHTML = `
                <div style="padding:24px;color:#fff;text-align:center">
                    Vue 加载失败<br>
                    <small style="opacity:.7">${err?.message || err}</small>
                </div>`;
        }
    }
}

/**
 * 退出手机
 */
function exitPhone() {
    if (!isPhoneShellOpen()) return;
    if (vueApp) {
        try { vueApp.unmount(); } catch (e) {}
        vueApp = null;
    }
    unmountPhoneShell();
    setIslandPhoneOpen(false);

    // 退出浏览器全屏
    try {
        const exit = document.exitFullscreen
            || document.webkitExitFullscreen
            || document.mozCancelFullScreen
            || document.msExitFullscreen;
        if (exit && document.fullscreenElement) {
            exit.call(document).catch(() => {});
        }
    } catch (e) { /* 忽略 */ }
}

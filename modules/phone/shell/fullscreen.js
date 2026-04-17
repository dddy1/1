/**
 * 手机全屏壳管理
 * 进入时：注入全屏蒙层 + Vue 挂载点；隐藏酒馆主 UI（#top-bar / #form_sheld 等）
 * 退出时：相反操作
 */

const SHELL_ID = 'ggg-phone-shell';
const HTML_PHONE_OPEN_CLASS = 'ggg-phone-open';

export function mountPhoneShell() {
    if (document.getElementById(SHELL_ID)) {
        return document.getElementById(SHELL_ID);
    }

    const shell = document.createElement('div');
    shell.id = SHELL_ID;
    shell.className = 'ggg-phone-shell';
    // 关键定位 —— 同样规避 <html> transform 包含块问题
    const s = shell.style;
    s.setProperty('position', 'fixed', 'important');
    s.setProperty('top', '0', 'important');
    s.setProperty('left', '0', 'important');
    s.setProperty('width', '100vw', 'important');
    s.setProperty('height', '100vh', 'important');
    s.setProperty('z-index', '99990', 'important');
    s.setProperty('display', 'flex', 'important');
    s.setProperty('flex-direction', 'column', 'important');
    // 起始：从下方升起
    s.setProperty('transform', 'translateY(100vh)', 'important');

    shell.innerHTML = `
        <div class="ggg-phone-status"></div>
        <div class="ggg-phone-viewport" id="ggg-phone-viewport">
            <!-- Vue 在此挂载 -->
            <div id="ggg-phone-app-mount"></div>
        </div>
    `;
    document.body.appendChild(shell);

    document.documentElement.classList.add(HTML_PHONE_OPEN_CLASS);

    // 触发上升动画
    requestAnimationFrame(() => requestAnimationFrame(() => {
        shell.style.setProperty('transform', 'translateY(0)', 'important');
    }));

    return shell;
}

export function unmountPhoneShell() {
    const shell = document.getElementById(SHELL_ID);
    if (!shell) return;
    shell.style.setProperty('transform', 'translateY(100vh)', 'important');
    setTimeout(() => {
        shell.remove();
        document.documentElement.classList.remove(HTML_PHONE_OPEN_CLASS);
    }, 280);
}

export function isPhoneShellOpen() {
    return !!document.getElementById(SHELL_ID);
}

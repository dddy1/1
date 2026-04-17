/**
 * 灵动岛 —— 常驻视口顶部中央
 * 行为：
 *   - 单击：切换酒馆 #top-bar 显隐
 *   - 双击：进入/退出手机
 * 同样要规避酒馆 <html> transform 导致的 fixed 包含块问题，
 * 用 vh 单位或 transform 来锚定位置。
 */

const ISLAND_ID = 'ggg-phone-island';
const TOP_BAR_HIDDEN_CLASS = 'ggg-phone-topbar-hidden';

let _onEnterPhone = null;
let _onExitPhone = null;
let _isPhoneOpen = false;

export function mountDynamicIsland({ onEnter, onExit }) {
    _onEnterPhone = onEnter;
    _onExitPhone = onExit;

    if (document.getElementById(ISLAND_ID)) return;

    const island = document.createElement('div');
    island.id = ISLAND_ID;
    island.className = 'ggg-phone-island';
    island.setAttribute('role', 'button');
    island.setAttribute('aria-label', '呱呱手机灵动岛');
    island.innerHTML = `<div class="ggg-phone-island-dot"></div>`;
    // 关键定位用内联 !important（同世界书面板的处理方式）
    const s = island.style;
    s.setProperty('position', 'fixed', 'important');
    s.setProperty('top', '6px', 'important');
    s.setProperty('left', '50%', 'important');
    s.setProperty('transform', 'translateX(-50%)', 'important');
    s.setProperty('z-index', '99998', 'important');

    document.body.appendChild(island);

    bindClickAndDoubleClick(island);
}

export function unmountDynamicIsland() {
    document.getElementById(ISLAND_ID)?.remove();
    document.documentElement.classList.remove(TOP_BAR_HIDDEN_CLASS);
}

export function setIslandPhoneOpen(open) {
    _isPhoneOpen = open;
    const island = document.getElementById(ISLAND_ID);
    if (!island) return;
    island.classList.toggle('open', open);
}

/**
 * 绑定单击/双击 —— 用延迟判定区分单击与双击
 * 单击 #top-bar 切换；双击进入/退出手机
 */
function bindClickAndDoubleClick(el) {
    let clickTimer = null;
    const DOUBLE_CLICK_DELAY = 250;

    const handleSingle = () => {
        document.documentElement.classList.toggle(TOP_BAR_HIDDEN_CLASS);
    };
    const handleDouble = () => {
        if (_isPhoneOpen) _onExitPhone?.();
        else _onEnterPhone?.();
    };

    const onTap = (e) => {
        e.preventDefault();
        if (clickTimer) {
            clearTimeout(clickTimer);
            clickTimer = null;
            handleDouble();
        } else {
            clickTimer = setTimeout(() => {
                clickTimer = null;
                handleSingle();
            }, DOUBLE_CLICK_DELAY);
        }
    };

    // touchend 优先；click 作为桌面端兜底
    el.addEventListener('touchend', onTap, { passive: false });
    el.addEventListener('click', (e) => {
        // 触摸端 touchend 已处理，避免 click 重复触发
        if (e.detail === 0) return; // 由键盘触发的可放行；触摸合成点也走这里时…
        // 简化：只要有 ongoing 的 clickTimer 就跳过原生 click
        onTap(e);
    });
}

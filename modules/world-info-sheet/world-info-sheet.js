/**
 * 世界书底部面板：把 #world_info 选择器替换为底部升起的可视化面板
 * - 移动端默认启用；PC 端可通过开关启用（用于测试）
 * - 同步原 <select multiple> 的选中状态，触发原生 change 事件，确保酒馆功能正常
 */
import { getSettings, saveAllSettings } from '../../index.js';

let inited = false;
let observer = null;

const WI_SELECTOR = '#world_info';
const TRIGGER_ID = 'ggg-wi-trigger';
const SHEET_ID = 'ggg-wi-sheet';

// ============================================================
// 初始化
// ============================================================
export function initWorldInfoSheet() {
    if (inited) return;
    inited = true;

    // 默认设置兜底
    const s = getSettings();
    if (!s.wiSheet) s.wiSheet = { enabled: false, pcMode: false };

    // 绑定面板内开关
    bindPanelControls();

    // 应用一次当前状态
    applyState();

    // 监听窗口尺寸变化（影响 mobile 判定）
    window.addEventListener('resize', () => debounce(applyState, 200));

    // 用 MutationObserver 等待 #world_info 出现 / 重建
    observer = new MutationObserver(() => {
        const sel = document.querySelector(WI_SELECTOR);
        if (sel && !sel.dataset.gggWiBound) applyState();
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

let _debTimer = null;
function debounce(fn, ms) {
    clearTimeout(_debTimer);
    _debTimer = setTimeout(fn, ms);
}

// ============================================================
// 状态判定 & 应用
// ============================================================
function isMobile() {
    // 与酒馆默认断点保持一致：宽度 < 1000px 视为移动
    return window.innerWidth < 1000;
}

function shouldEnable() {
    const s = getSettings().wiSheet || {};
    if (!s.enabled) return false;
    return isMobile() || s.pcMode;
}

function applyState() {
    const sel = document.querySelector(WI_SELECTOR);
    if (!sel) return;
    if (shouldEnable()) {
        enableSheet(sel);
    } else {
        disableSheet(sel);
    }
}

// ============================================================
// 启用：隐藏原 select，注入触发按钮
// ============================================================
function enableSheet(sel) {
    sel.dataset.gggWiBound = '1';
    sel.classList.add('ggg-wi-hidden');

    // 注入触发按钮（紧跟在原 select 之后）
    let trigger = document.getElementById(TRIGGER_ID);
    if (!trigger) {
        trigger = document.createElement('div');
        trigger.id = TRIGGER_ID;
        trigger.className = 'ggg-wi-trigger';
        trigger.addEventListener('click', () => openSheet(sel));
        sel.parentNode.insertBefore(trigger, sel.nextSibling);
    }
    updateTriggerLabel(sel, trigger);

    // 同步：原 select 变化时刷新按钮文字
    if (!sel.dataset.gggWiListener) {
        sel.dataset.gggWiListener = '1';
        sel.addEventListener('change', () => {
            updateTriggerLabel(sel, document.getElementById(TRIGGER_ID));
        });
    }
}

function disableSheet(sel) {
    sel.classList.remove('ggg-wi-hidden');
    delete sel.dataset.gggWiBound;
    document.getElementById(TRIGGER_ID)?.remove();
    closeSheet();
}

function updateTriggerLabel(sel, trigger) {
    if (!trigger) return;
    const selected = Array.from(sel.selectedOptions);
    const total = sel.options.length;
    const count = selected.length;
    let preview = '';
    if (count === 0) {
        preview = '未选择世界书';
    } else if (count <= 2) {
        preview = selected.map(o => o.textContent.trim()).join('、');
    } else {
        preview = `已选 ${count} 个`;
    }
    trigger.innerHTML = `
        <i class="ggg-fa fa-solid fa-book-open"></i>
        <span class="ggg-wi-trigger-label">${escapeHtml(preview)}</span>
        <span class="ggg-wi-trigger-count">${count}/${total}</span>
        <i class="ggg-fa fa-solid fa-chevron-up"></i>
    `;
}

// ============================================================
// 底部面板
// ============================================================
function openSheet(sel) {
    closeSheet();
    const overlay = document.createElement('div');
    overlay.id = SHEET_ID;
    overlay.className = 'ggg-wi-overlay';
    overlay.innerHTML = `
        <div class="ggg-wi-sheet" role="dialog" aria-label="选择世界书">
            <div class="ggg-wi-sheet-handle"></div>
            <div class="ggg-wi-sheet-header">
                <i class="ggg-fa fa-solid fa-book-open"></i>
                <span class="ggg-wi-sheet-title">选择世界书</span>
                <input type="text" class="ggg-wi-search" placeholder="搜索…">
                <button class="ggg-wi-close" title="关闭"><i class="ggg-fa fa-solid fa-xmark"></i></button>
            </div>
            <div class="ggg-wi-sheet-toolbar">
                <button class="ggg-wi-btn-clear"><i class="ggg-fa fa-solid fa-eraser"></i> 全不选</button>
                <span class="ggg-wi-count">已选 0</span>
            </div>
            <div class="ggg-wi-sheet-body"></div>
        </div>
    `;
    document.body.appendChild(overlay);

    // 渲染选项列表
    const body = overlay.querySelector('.ggg-wi-sheet-body');
    renderOptions(sel, body);

    // 事件
    const closeBtn = overlay.querySelector('.ggg-wi-close');
    closeBtn.addEventListener('click', closeSheet);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeSheet(); });

    overlay.querySelector('.ggg-wi-btn-clear').addEventListener('click', () => {
        Array.from(sel.options).forEach(o => o.selected = false);
        triggerNativeChange(sel);
        renderOptions(sel, body);
        updateTriggerLabel(sel, document.getElementById(TRIGGER_ID));
        updateSheetCount(overlay, sel);
    });

    const search = overlay.querySelector('.ggg-wi-search');
    search.addEventListener('input', () => {
        const kw = search.value.trim().toLowerCase();
        body.querySelectorAll('.ggg-wi-item').forEach(li => {
            const txt = li.dataset.text || '';
            li.style.display = (!kw || txt.includes(kw)) ? '' : 'none';
        });
    });
    // 阻止搜索框按键冒泡到酒馆快捷键
    ['keydown','keyup','keypress','input'].forEach(ev =>
        search.addEventListener(ev, e => e.stopPropagation()));

    updateSheetCount(overlay, sel);

    // ESC 关闭
    const escHandler = e => { if (e.key === 'Escape') { closeSheet(); document.removeEventListener('keydown', escHandler); } };
    document.addEventListener('keydown', escHandler);

    // 触发动画
    requestAnimationFrame(() => overlay.classList.add('open'));
}

function renderOptions(sel, body) {
    const items = Array.from(sel.options).map((opt, idx) => {
        const txt = (opt.textContent || '').trim();
        const checked = opt.selected ? 'checked' : '';
        return `
            <label class="ggg-wi-item ${opt.selected ? 'selected' : ''}"
                   data-idx="${idx}" data-text="${escapeAttr(txt.toLowerCase())}">
                <input type="checkbox" ${checked}>
                <span class="ggg-wi-item-name">${escapeHtml(txt)}</span>
            </label>
        `;
    }).join('');
    body.innerHTML = items || '<div class="ggg-wi-empty">未发现世界书</div>';

    // 绑定切换
    body.querySelectorAll('.ggg-wi-item').forEach(li => {
        const cb = li.querySelector('input');
        cb.addEventListener('click', e => e.stopPropagation()); // 防双触发
        cb.addEventListener('change', () => {
            const idx = parseInt(li.dataset.idx, 10);
            sel.options[idx].selected = cb.checked;
            li.classList.toggle('selected', cb.checked);
            triggerNativeChange(sel);
            updateTriggerLabel(sel, document.getElementById(TRIGGER_ID));
            updateSheetCount(li.closest('.ggg-wi-overlay'), sel);
        });
    });
}

function updateSheetCount(overlay, sel) {
    if (!overlay) return;
    const cnt = overlay.querySelector('.ggg-wi-count');
    if (cnt) cnt.textContent = `已选 ${Array.from(sel.selectedOptions).length}`;
}

function closeSheet() {
    const overlay = document.getElementById(SHEET_ID);
    if (!overlay) return;
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 220);
}

function triggerNativeChange(sel) {
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    // jQuery 兼容（酒馆很多代码监听 jQuery change）
    if (window.jQuery) window.jQuery(sel).trigger('change');
}

// ============================================================
// 设置面板内开关绑定
// ============================================================
function bindPanelControls() {
    document.addEventListener('change', e => {
        const t = e.target;
        if (!t || !t.id) return;
        const s = getSettings();
        if (!s.wiSheet) s.wiSheet = { enabled: false, pcMode: false };
        if (t.id === 'ggg-wi-toggle-enabled') {
            s.wiSheet.enabled = !!t.checked;
            saveAllSettings();
            applyState();
        } else if (t.id === 'ggg-wi-toggle-pc') {
            s.wiSheet.pcMode = !!t.checked;
            saveAllSettings();
            applyState();
        }
    });

    // 面板首次渲染时回填开关状态
    document.addEventListener('ggg-tab-shown', refreshControls);
    refreshControls();
}

function refreshControls() {
    const s = getSettings().wiSheet || {};
    const a = document.getElementById('ggg-wi-toggle-enabled');
    const b = document.getElementById('ggg-wi-toggle-pc');
    if (a) a.checked = !!s.enabled;
    if (b) b.checked = !!s.pcMode;
}

// ============================================================
// 工具函数
// ============================================================
function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c =>
        ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

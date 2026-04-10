/**
 * 图库模块
 * - 支持 tag 管理（添加/删除/筛选）
 * - 支持按尺寸分类（正方形/宽长方形/窄长方形）
 * - 支持多选、全选、批量删除
 */
import { getSettings, saveAllSettings } from '../../index.js';

let galleryImages = [];
let activeTags = [];       // 当前筛选的 tag
let sizeSort = false;       // 是否按尺寸分类
let multiSelectMode = false;
let selectedIndices = new Set();

// 头像库
let avatarImages = [];
let avatarActiveTags = [];
let avatarBypassing = false;

// 图片尺寸分类的宽高比阈值
const ASPECT_SQUARE_MIN = 0.8;
const ASPECT_SQUARE_MAX = 1.25;

export function initGallery() {
    const settings = getSettings();
    galleryImages = settings.gallery || [];
    galleryImages.forEach(img => { if (!img.tags) img.tags = []; });
    avatarImages = settings.avatars || [];
    avatarImages.forEach(img => { if (!img.tags) img.tags = []; });

    renderGalleryPanel();
    initGalleryEvents();
    refreshGalleryGrid();
    refreshAvatarGrid();
    updateAvatarShape();
    initAvatarIntercept();

    // 监听上传请求（来自 ui-custom 模块）
    document.addEventListener('ggg-upload-request', async (e) => {
        const { files, callback } = e.detail;
        let count = 0;
        for (const file of files) {
            try { await uploadToGGG(file, 'gallery'); count++; } catch (err) { console.error('[ggg] 上传失败:', err); toastr.error(`上传失败: ${file.name}`); }
        }
        saveAllSettings();
        if (count > 0) toastr.success(`已上传 ${count} 张图片`);
        refreshGalleryGrid();
        if (callback) callback();
    });
}

export function getGalleryImages() { return galleryImages; }

/** 获取所有存在的 tag（去重） */
export function getAllTags() {
    const tagSet = new Set();
    galleryImages.forEach(img => {
        if (img.tags) img.tags.forEach(t => tagSet.add(t));
    });
    return [...tagSet].sort();
}

function renderGalleryPanel() {
    const panel = document.getElementById('ggg-panel-gallery');
    if (!panel || panel.querySelector('#ggg-gallery-subtabs')) return;

    panel.innerHTML = `
        <div id="ggg-gallery-subtabs">
            <div class="ggg-gallery-subtab active" data-gallery-tab="gallery"><i class="ggg-fa fa-solid fa-images"></i> 图库</div>
            <div class="ggg-gallery-subtab" data-gallery-tab="avatar"><i class="ggg-fa fa-solid fa-user-circle"></i> 头像库</div>
            <div class="ggg-gallery-subtab" data-gallery-tab="sticker"><i class="ggg-fa fa-solid fa-face-smile"></i> 表情包</div>
        </div>
        <div id="ggg-gallery-panel-gallery" class="ggg-gallery-panel active">
            <div class="ggg-gallery-toolbar-row">
                <span class="ggg-gallery-count" id="ggg-gallery-count">0 张图片</span>
                <div class="ggg-gallery-toolbar-actions">
                    <label class="ggg-size-sort-label" title="按尺寸分类显示">
                        <input type="checkbox" id="ggg-size-sort-toggle">
                        <i class="ggg-fa fa-solid fa-arrows-up-down"></i>
                        <span>尺寸分类</span>
                    </label>
                    <div id="ggg-btn-multi-select" class="menu_button menu_button_icon ggg-btn-small" title="多选模式">
                        <i class="ggg-fa fa-solid fa-list-check"></i> 多选
                    </div>
                    <div id="ggg-btn-upload-gallery" class="menu_button menu_button_icon ggg-btn-small" title="上传图片">
                        <i class="ggg-fa fa-solid fa-upload"></i> 上传
                    </div>
                </div>
            </div>
            <div id="ggg-gallery-multi-bar" style="display:none;">
                <div id="ggg-btn-select-all" class="menu_button menu_button_icon ggg-btn-small" title="全选"><i class="ggg-fa fa-solid fa-check-double"></i> 全选</div>
                <div id="ggg-btn-deselect-all" class="menu_button menu_button_icon ggg-btn-small" title="取消全选"><i class="ggg-fa fa-solid fa-xmark"></i> 取消</div>
                <div id="ggg-btn-batch-tag" class="menu_button menu_button_icon ggg-btn-small" title="批量添加标签"><i class="ggg-fa fa-solid fa-tags"></i> 标签</div>
                <div id="ggg-btn-batch-delete" class="menu_button menu_button_icon ggg-btn-small ggg-btn-danger" title="批量删除"><i class="ggg-fa fa-solid fa-trash"></i> 删除</div>
                <span id="ggg-multi-count" class="ggg-multi-count">已选 0 张</span>
            </div>
            <div id="ggg-gallery-tag-filter"></div>
            <div id="ggg-gallery-grid"></div>
            <div id="ggg-no-gallery" class="ggg-empty-state">
                <div class="ggg-empty-icon"><i class="ggg-fa fa-solid fa-images"></i></div>
                <div>还没有上传图片</div>
                <div class="ggg-empty-hint">点击上方"上传"按钮添加图片</div>
            </div>
        </div>
        <div id="ggg-gallery-panel-avatar" class="ggg-gallery-panel">
            <div class="ggg-gallery-toolbar-row">
                <span class="ggg-gallery-count" id="ggg-avatar-count">0 张头像</span>
                <div class="ggg-gallery-toolbar-actions">
                    <div id="ggg-btn-upload-avatar" class="menu_button menu_button_icon ggg-btn-small" title="上传头像">
                        <i class="ggg-fa fa-solid fa-upload"></i> 上传
                    </div>
                </div>
            </div>
            <div id="ggg-avatar-tag-filter"></div>
            <div id="ggg-avatar-grid" class="ggg-avatar-grid"></div>
            <div id="ggg-no-avatar" class="ggg-empty-state">
                <div class="ggg-empty-icon"><i class="ggg-fa fa-solid fa-user-circle"></i></div>
                <div>还没有上传头像</div>
                <div class="ggg-empty-hint">点击上方"上传"按钮添加头像</div>
            </div>
        </div>
        <div id="ggg-gallery-panel-sticker" class="ggg-gallery-panel">
            <div class="ggg-empty-state">
                <div class="ggg-empty-icon"><i class="ggg-fa fa-solid fa-face-smile"></i></div>
                <div>表情包功能 - 开发中</div>
            </div>
        </div>`;
}

function initGalleryEvents() {
    document.querySelectorAll('.ggg-gallery-subtab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.ggg-gallery-subtab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.ggg-gallery-panel').forEach(p => p.classList.remove('active'));
            document.getElementById(`ggg-gallery-panel-${tab.dataset.galleryTab}`)?.classList.add('active');
        });
    });

    initAvatarEvents();

    document.getElementById('ggg-btn-upload-gallery')?.addEventListener('click', () => {
        triggerUpload('gallery', () => refreshGalleryGrid());
    });

    // 尺寸分类开关
    document.getElementById('ggg-size-sort-toggle')?.addEventListener('change', (e) => {
        sizeSort = e.target.checked;
        refreshGalleryGrid();
    });

    // 多选模式
    document.getElementById('ggg-btn-multi-select')?.addEventListener('click', () => {
        multiSelectMode = !multiSelectMode;
        selectedIndices.clear();
        const btn = document.getElementById('ggg-btn-multi-select');
        const bar = document.getElementById('ggg-gallery-multi-bar');
        if (btn) btn.classList.toggle('active', multiSelectMode);
        if (bar) bar.style.display = multiSelectMode ? 'flex' : 'none';
        refreshGalleryGrid();
    });

    // 全选
    document.getElementById('ggg-btn-select-all')?.addEventListener('click', () => {
        const visibleImages = getFilteredImages();
        visibleImages.forEach(({ origIndex }) => selectedIndices.add(origIndex));
        updateMultiSelectCount();
        refreshGalleryGrid();
    });

    // 取消全选
    document.getElementById('ggg-btn-deselect-all')?.addEventListener('click', () => {
        selectedIndices.clear();
        updateMultiSelectCount();
        refreshGalleryGrid();
    });

    // 批量标签
    document.getElementById('ggg-btn-batch-tag')?.addEventListener('click', async () => {
        if (selectedIndices.size === 0) { toastr.info('请先选择图片'); return; }
        await showBatchTagPopup([...selectedIndices]);
    });

    // 批量删除
    document.getElementById('ggg-btn-batch-delete')?.addEventListener('click', async () => {
        if (selectedIndices.size === 0) { toastr.info('请先选择图片'); return; }
        const { callGenericPopup, POPUP_TYPE } = SillyTavern.getContext();
        const confirmed = await callGenericPopup(`确定删除选中的 ${selectedIndices.size} 张图片吗？`, POPUP_TYPE.CONFIRM);
        if (!confirmed) return;

        // 按索引从大到小删除，避免索引偏移
        const idxArr = [...selectedIndices].sort((a, b) => b - a);
        for (const idx of idxArr) {
            const img = galleryImages[idx];
            if (img?.filename) {
                try {
                    await fetch('/api/backgrounds/delete', {
                        method: 'POST',
                        headers: SillyTavern.getContext().getRequestHeaders(),
                        body: JSON.stringify({ bg: img.filename }),
                    });
                } catch (err) { console.warn('[ggg] 删除服务器文件失败:', err); }
            }
            galleryImages.splice(idx, 1);
        }
        const settings = getSettings();
        settings.gallery = galleryImages;
        saveAllSettings();
        selectedIndices.clear();
        updateMultiSelectCount();
        refreshGalleryGrid();
        toastr.success(`已删除 ${idxArr.length} 张图片`);
    });
}

function updateMultiSelectCount() {
    const el = document.getElementById('ggg-multi-count');
    if (el) el.textContent = `已选 ${selectedIndices.size} 张`;
}

/** 获取经过 tag 筛选的图片（含原索引） */
function getFilteredImages() {
    const results = [];
    galleryImages.forEach((img, idx) => {
        if (activeTags.length > 0) {
            const imgTags = img.tags || [];
            if (!activeTags.some(t => imgTags.includes(t))) return;
        }
        results.push({ img, origIndex: idx });
    });
    return results;
}

/** 图片尺寸分类 */
function classifyBySize(img) {
    if (!img._aspectRatio) return 'unknown';
    const r = img._aspectRatio;
    if (r >= ASPECT_SQUARE_MIN && r <= ASPECT_SQUARE_MAX) return 'square';
    if (r > ASPECT_SQUARE_MAX) return 'wide';
    return 'tall';
}

const SIZE_LABELS = {
    'square': '⬜ 正方形',
    'wide': '▬ 宽长方形',
    'tall': '▮ 窄长方形',
    'unknown': '❓ 未知',
};

function triggerUpload(type, callback) {
    const fileInput = document.getElementById('ggg-file-input');
    if (!fileInput) return;

    const handler = async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        let count = 0;
        for (const file of files) {
            try { await uploadToGGG(file, type); count++; } catch (err) { console.error('[ggg] 上传失败:', err); toastr.error(`上传失败: ${file.name}`); }
        }
        fileInput.value = '';
        fileInput.removeEventListener('change', handler);
        saveAllSettings();
        if (count > 0) toastr.success(`已上传 ${count} 张图片`);
        if (callback) callback();
    };

    fileInput.addEventListener('change', handler);
    fileInput.click();
}

async function uploadToGGG(file, type = 'gallery') {
    const prefix = `ggg_${type}_${Date.now()}_`;
    const filename = prefix + file.name;
    const formData = new FormData();
    formData.append('avatar', file, filename);

    const headers = {};
    const origH = SillyTavern.getContext().getRequestHeaders();
    for (const [k, v] of Object.entries(origH)) {
        if (k.toLowerCase() !== 'content-type') headers[k] = v;
    }

    const resp = await fetch('/api/backgrounds/upload', { method: 'POST', headers, body: formData });
    if (!resp.ok) throw new Error(`上传失败: ${resp.status}`);

    const url = `/backgrounds/${filename}`;
    galleryImages.push({ name: file.name, url, filename, timestamp: Date.now(), tags: [] });
    const settings = getSettings();
    settings.gallery = galleryImages;
    return url;
}

/** 预加载图片获取尺寸 */
function preloadImageSize(img) {
    return new Promise((resolve) => {
        if (img._aspectRatio) { resolve(); return; }
        const image = new Image();
        image.onload = () => {
            img._width = image.naturalWidth;
            img._height = image.naturalHeight;
            img._aspectRatio = image.naturalWidth / image.naturalHeight;
            resolve();
        };
        image.onerror = () => {
            img._aspectRatio = 0;
            resolve();
        };
        image.src = img.url;
    });
}

/** 渲染 tag 筛选栏 */
function renderTagFilter() {
    const container = document.getElementById('ggg-gallery-tag-filter');
    if (!container) return;

    const allTags = getAllTags();
    if (allTags.length === 0) {
        container.innerHTML = '';
        container.style.display = 'none';
        return;
    }

    container.style.display = 'flex';
    container.innerHTML = `
        <span class="ggg-tag-filter-label"><i class="ggg-fa fa-solid fa-filter"></i></span>
        ${allTags.map(tag => `
            <span class="ggg-tag-chip ${activeTags.includes(tag) ? 'active' : ''}" data-tag="${escapeAttr(tag)}">
                ${escapeHtml(tag)}
            </span>
        `).join('')}
        ${activeTags.length > 0 ? '<span class="ggg-tag-chip ggg-tag-clear" title="清除筛选"><i class="ggg-fa fa-solid fa-xmark"></i></span>' : ''}
    `;

    container.querySelectorAll('.ggg-tag-chip:not(.ggg-tag-clear)').forEach(chip => {
        chip.addEventListener('click', () => {
            const tag = chip.dataset.tag;
            const idx = activeTags.indexOf(tag);
            if (idx >= 0) activeTags.splice(idx, 1);
            else activeTags.push(tag);
            refreshGalleryGrid();
        });
    });

    container.querySelector('.ggg-tag-clear')?.addEventListener('click', () => {
        activeTags = [];
        refreshGalleryGrid();
    });
}

function refreshGalleryGrid() {
    const grid = document.getElementById('ggg-gallery-grid');
    const empty = document.getElementById('ggg-no-gallery');
    const countEl = document.getElementById('ggg-gallery-count');
    if (!grid) return;

    renderTagFilter();

    const filtered = getFilteredImages();

    if (countEl) countEl.textContent = `${galleryImages.length} 张图片${activeTags.length > 0 ? ` (筛选: ${filtered.length})` : ''}`;

    if (galleryImages.length === 0) {
        grid.innerHTML = ''; grid.style.display = 'none';
        if (empty) empty.style.display = ''; return;
    }

    grid.style.display = ''; if (empty) empty.style.display = 'none';

    if (filtered.length === 0) {
        grid.innerHTML = '<div class="ggg-empty-state" style="grid-column:1/-1;padding:20px;"><div>没有匹配的图片</div></div>';
        return;
    }

    if (sizeSort) {
        // 先预加载尺寸，再渲染
        Promise.all(filtered.map(({ img }) => preloadImageSize(img))).then(() => {
            renderGridWithSizeGroups(grid, filtered);
        });
    } else {
        renderGridFlat(grid, filtered);
    }
}

function renderGridFlat(grid, items) {
    grid.innerHTML = items.map(({ img, origIndex }) => buildGalleryItemHTML(img, origIndex)).join('');
    bindGalleryItemEvents(grid);
}

function renderGridWithSizeGroups(grid, items) {
    const groups = { square: [], wide: [], tall: [], unknown: [] };
    items.forEach(entry => {
        const cat = classifyBySize(entry.img);
        groups[cat].push(entry);
    });

    let html = '';
    for (const [cat, entries] of Object.entries(groups)) {
        if (entries.length === 0) continue;
        html += `<div class="ggg-gallery-size-group-title">${SIZE_LABELS[cat]} (${entries.length})</div>`;
        html += entries.map(({ img, origIndex }) => buildGalleryItemHTML(img, origIndex)).join('');
    }
    grid.innerHTML = html;
    bindGalleryItemEvents(grid);
}

function buildGalleryItemHTML(img, idx) {
    const isSelected = selectedIndices.has(idx);
    const tagStr = (img.tags || []).length > 0 ? `<div class="ggg-gallery-item-tags">${(img.tags || []).map(t => `<span class="ggg-gallery-tag-mini">${escapeHtml(t)}</span>`).join('')}</div>` : '';

    return `
        <div class="ggg-gallery-item ${multiSelectMode && isSelected ? 'selected' : ''}" style="background-image: url('${escapeAttr(img.url)}')" data-index="${idx}">
            ${multiSelectMode ? `<div class="ggg-gallery-checkbox ${isSelected ? 'checked' : ''}"><i class="ggg-fa fa-solid ${isSelected ? 'fa-square-check' : 'fa-square'}"></i></div>` : ''}
            <button class="ggg-gallery-delete" data-index="${idx}" title="删除"><i class="ggg-fa fa-solid fa-xmark"></i></button>
            <button class="ggg-gallery-tag-btn" data-index="${idx}" title="管理标签"><i class="ggg-fa fa-solid fa-tag"></i></button>
            ${tagStr}
            <div class="ggg-gallery-item-name" title="${escapeAttr(img.name)}">${escapeHtml(img.name)}</div>
        </div>
    `;
}

function bindGalleryItemEvents(grid) {
    // 多选点击
    grid.querySelectorAll('.ggg-gallery-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('.ggg-gallery-delete') || e.target.closest('.ggg-gallery-tag-btn')) return;
            if (!multiSelectMode) return;
            const idx = parseInt(item.dataset.index);
            if (selectedIndices.has(idx)) selectedIndices.delete(idx);
            else selectedIndices.add(idx);
            updateMultiSelectCount();
            refreshGalleryGrid();
        });
    });

    // 删除
    grid.querySelectorAll('.ggg-gallery-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.index);
            const img = galleryImages[idx];
            if (img?.filename) {
                try {
                    await fetch('/api/backgrounds/delete', {
                        method: 'POST',
                        headers: SillyTavern.getContext().getRequestHeaders(),
                        body: JSON.stringify({ bg: img.filename }),
                    });
                } catch (err) { console.warn('[ggg] 删除服务器文件失败:', err); }
            }
            galleryImages.splice(idx, 1);
            selectedIndices.delete(idx);
            // 修正 selectedIndices 中大于 idx 的索引
            const newSet = new Set();
            selectedIndices.forEach(i => newSet.add(i > idx ? i - 1 : i));
            selectedIndices = newSet;
            const settings = getSettings();
            settings.gallery = galleryImages;
            saveAllSettings();
            updateMultiSelectCount();
            refreshGalleryGrid();
        });
    });

    // 标签管理按钮
    grid.querySelectorAll('.ggg-gallery-tag-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.index);
            await showTagPopup(idx);
        });
    });
}

/** 显示单张图片的标签管理弹窗 */
async function showTagPopup(imgIndex) {
    const img = galleryImages[imgIndex];
    if (!img) return;

    const allTags = getAllTags();
    const imgTags = img.tags || [];

    // 使用模块级变量跟踪临时标签状态
    let tempTags = [...imgTags];

    const html = `
        <div class="ggg-tag-popup">
            <div class="ggg-tag-popup-title">管理标签 - ${escapeHtml(img.name)}</div>
            <div class="ggg-tag-popup-preview" style="background-image: url('${escapeAttr(img.url)}')"></div>
            <div class="ggg-tag-popup-section">
                <div class="ggg-tag-popup-subtitle">已有标签（点击勾选/取消）</div>
                <div class="ggg-tag-popup-tags" id="ggg-tag-popup-existing">
                    ${allTags.length > 0 ? allTags.map(tag => `
                        <label class="ggg-tag-popup-chip">
                            <input type="checkbox" value="${escapeAttr(tag)}" ${imgTags.includes(tag) ? 'checked' : ''}>
                            <span>${escapeHtml(tag)}</span>
                        </label>
                    `).join('') : '<span style="opacity:0.5;font-size:0.85em;">暂无标签</span>'}
                </div>
            </div>
            <div class="ggg-tag-popup-section">
                <div class="ggg-tag-popup-subtitle">添加新标签</div>
                <div class="ggg-tag-popup-new-row">
                    <input type="text" id="ggg-tag-new-input" class="text_pole" placeholder="输入新标签名...">
                    <div id="ggg-tag-add-btn" class="menu_button menu_button_icon ggg-btn-small"><i class="ggg-fa fa-solid fa-plus"></i></div>
                </div>
            </div>
            <div class="ggg-tag-popup-section">
                <div class="ggg-tag-popup-subtitle">当前标签</div>
                <div id="ggg-tag-popup-current" class="ggg-tag-popup-current-tags"></div>
            </div>
        </div>
    `;

    const { callGenericPopup, POPUP_TYPE } = SillyTavern.getContext();

    // 在弹窗渲染后绑定事件
    setTimeout(() => {
        const currentTagsEl = document.getElementById('ggg-tag-popup-current');

        function renderCurrentTags() {
            if (!currentTagsEl) return;
            currentTagsEl.innerHTML = tempTags.length > 0
                ? tempTags.map(t => `<span class="ggg-tag-current-chip">${escapeHtml(t)} <i class="ggg-fa fa-solid fa-xmark ggg-tag-remove" data-tag="${escapeAttr(t)}"></i></span>`).join('')
                : '<span style="opacity:0.5;font-size:0.85em;">无标签</span>';

            currentTagsEl.querySelectorAll('.ggg-tag-remove').forEach(rm => {
                rm.addEventListener('click', () => {
                    const tag = rm.dataset.tag;
                    tempTags = tempTags.filter(t => t !== tag);
                    // 同步复选框
                    document.querySelectorAll('#ggg-tag-popup-existing input[type="checkbox"]').forEach(cb => {
                        if (cb.value === tag) cb.checked = false;
                    });
                    renderCurrentTags();
                });
            });
        }

        renderCurrentTags();

        // 已有标签勾选
        document.querySelectorAll('#ggg-tag-popup-existing input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => {
                const tag = cb.value;
                if (cb.checked) {
                    if (!tempTags.includes(tag)) tempTags.push(tag);
                } else {
                    tempTags = tempTags.filter(t => t !== tag);
                }
                renderCurrentTags();
            });
        });

        // 添加新标签
        const addBtn = document.getElementById('ggg-tag-add-btn');
        const addInput = document.getElementById('ggg-tag-new-input');

        function addNewTag() {
            if (!addInput) return;
            const val = addInput.value.trim();
            if (!val) return;
            if (!tempTags.includes(val)) {
                tempTags.push(val);
                renderCurrentTags();
            }
            addInput.value = '';
        }

        addBtn?.addEventListener('click', addNewTag);
        addInput?.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') { e.preventDefault(); addNewTag(); }
        });
        ['keyup', 'keypress', 'input'].forEach(evt => {
            addInput?.addEventListener(evt, (e) => e.stopPropagation());
        });
    }, 100);

    const result = await callGenericPopup(html, POPUP_TYPE.CONFIRM, '', {
        okButton: '保存',
        cancelButton: '取消',
        wide: false,
        allowVerticalScrolling: true,
    });

    if (result) {
        // tempTags 闭包中已更新为最终状态
        img.tags = [...tempTags];
        const settings = getSettings();
        settings.gallery = galleryImages;
        saveAllSettings();
        refreshGalleryGrid();
        toastr.success(`已更新标签: ${img.name}`);
    }
}

/** 批量标签管理弹窗 */
async function showBatchTagPopup(indices) {
    const allTags = getAllTags();
    const newTags = [];

    const html = `
        <div class="ggg-tag-popup">
            <div class="ggg-tag-popup-title">批量管理标签（${indices.length} 张图片）</div>
            <div class="ggg-tag-popup-section">
                <div class="ggg-tag-popup-subtitle">选择要添加的标签</div>
                <div class="ggg-tag-popup-tags" id="ggg-batch-tag-existing">
                    ${allTags.length > 0 ? allTags.map(tag => `
                        <label class="ggg-tag-popup-chip">
                            <input type="checkbox" value="${escapeAttr(tag)}">
                            <span>${escapeHtml(tag)}</span>
                        </label>
                    `).join('') : '<span style="opacity:0.5;font-size:0.85em;">暂无标签</span>'}
                </div>
            </div>
            <div class="ggg-tag-popup-section">
                <div class="ggg-tag-popup-subtitle">添加新标签</div>
                <div class="ggg-tag-popup-new-row">
                    <input type="text" id="ggg-batch-tag-new-input" class="text_pole" placeholder="输入新标签名...">
                    <div id="ggg-batch-tag-add-btn" class="menu_button menu_button_icon ggg-btn-small"><i class="ggg-fa fa-solid fa-plus"></i></div>
                </div>
                <div id="ggg-batch-tag-new-list" class="ggg-tag-popup-current-tags" style="margin-top:6px;"></div>
            </div>
        </div>
    `;

    const { callGenericPopup, POPUP_TYPE } = SillyTavern.getContext();

    setTimeout(() => {
        const newListEl = document.getElementById('ggg-batch-tag-new-list');
        const addBtn = document.getElementById('ggg-batch-tag-add-btn');
        const addInput = document.getElementById('ggg-batch-tag-new-input');

        function renderNewTags() {
            if (!newListEl) return;
            newListEl.innerHTML = newTags.map(t =>
                `<span class="ggg-tag-current-chip">${escapeHtml(t)} <i class="ggg-fa fa-solid fa-xmark ggg-batch-tag-remove" data-tag="${escapeAttr(t)}"></i></span>`
            ).join('');
            newListEl.querySelectorAll('.ggg-batch-tag-remove').forEach(rm => {
                rm.addEventListener('click', () => {
                    const tag = rm.dataset.tag;
                    const idx = newTags.indexOf(tag);
                    if (idx >= 0) newTags.splice(idx, 1);
                    renderNewTags();
                });
            });
        }

        function addNewTag() {
            if (!addInput) return;
            const val = addInput.value.trim();
            if (!val) return;
            if (!newTags.includes(val)) {
                newTags.push(val);
                renderNewTags();
            }
            addInput.value = '';
        }

        addBtn?.addEventListener('click', addNewTag);
        addInput?.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') { e.preventDefault(); addNewTag(); }
        });
        ['keyup', 'keypress', 'input'].forEach(evt => {
            addInput?.addEventListener(evt, (e) => e.stopPropagation());
        });
    }, 100);

    const result = await callGenericPopup(html, POPUP_TYPE.CONFIRM, '', {
        okButton: '添加',
        cancelButton: '取消',
        wide: false,
        allowVerticalScrolling: true,
    });

    if (result) {
        // 从 DOM 中读取勾选的已有标签
        const checkedTags = [];
        document.querySelectorAll('#ggg-batch-tag-existing input[type="checkbox"]:checked').forEach(cb => {
            checkedTags.push(cb.value);
        });
        const tagsToAdd = [...checkedTags, ...newTags];

        if (tagsToAdd.length === 0) { toastr.info('没有选择标签'); return; }

        indices.forEach(idx => {
            const img = galleryImages[idx];
            if (!img) return;
            if (!img.tags) img.tags = [];
            tagsToAdd.forEach(tag => {
                if (!img.tags.includes(tag)) img.tags.push(tag);
            });
        });

        const settings = getSettings();
        settings.gallery = galleryImages;
        saveAllSettings();
        refreshGalleryGrid();
        toastr.success(`已为 ${indices.length} 张图片添加标签`);
    }
}

function escapeHtml(str) { if (!str) return ''; const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
function escapeAttr(str) { if (!str) return ''; return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#039;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// ============================================================
// 头像库
// ============================================================

/** 从 SillyTavern 的聊天头像中读取当前 border-radius 设置 */
function getAvatarBorderRadius() {
    // 尝试从聊天中已渲染的头像元素读取 border-radius
    const chatAvatar = document.querySelector('#chat .mes .avatar img');
    if (chatAvatar) {
        const computed = getComputedStyle(chatAvatar);
        const br = computed.borderRadius;
        if (br && br !== '0px') return br;
    }
    // 再试其他位置的头像
    const anyAvatar = document.querySelector('.avatar img');
    if (anyAvatar) {
        const computed = getComputedStyle(anyAvatar);
        return computed.borderRadius || '50%';
    }
    return '50%'; // 默认圆形
}

/** 更新头像形状 CSS 变量（跟随酒馆全局设置） */
export function updateAvatarShape() {
    const radius = getAvatarBorderRadius();
    document.documentElement.style.setProperty('--ggg-avatar-radius', radius);
}

function refreshAvatarGrid() {
    const grid = document.getElementById('ggg-avatar-grid');
    const empty = document.getElementById('ggg-no-avatar');
    const count = document.getElementById('ggg-avatar-count');
    if (!grid) return;

    let filtered = avatarImages;
    if (avatarActiveTags.length > 0) {
        filtered = avatarImages.filter(img => avatarActiveTags.every(t => img.tags?.includes(t)));
    }

    if (count) count.textContent = `${filtered.length} 张头像`;
    if (filtered.length === 0) { grid.innerHTML = ''; grid.style.display = 'none'; if (empty) empty.style.display = ''; return; }
    grid.style.display = ''; if (empty) empty.style.display = 'none';


    let html = '';
    filtered.forEach((img, i) => {
        const realIdx = avatarImages.indexOf(img);
        const avatarTagsHtml = (img.tags && img.tags.length > 0)
            ? `<div class="ggg-avatar-tags">${img.tags.map(t => `<span class="ggg-avatar-tag-chip">${escapeHtml(t)}</span>`).join('')}</div>`
            : '';
        html += `<div class="ggg-avatar-item" data-avatar-index="${realIdx}">
            <div class="ggg-avatar-thumb" style="background-image: url('${escapeAttr(img.url)}');"></div>
            ${avatarTagsHtml}
            <div class="ggg-avatar-actions">
                <span class="ggg-text-btn ggg-avatar-tag-btn" data-avatar-index="${realIdx}" title="标签"><i class="ggg-fa fa-solid fa-tag"></i></span>
                <span class="ggg-text-btn ggg-avatar-delete-btn" data-avatar-index="${realIdx}" title="删除"><i class="ggg-fa fa-solid fa-trash"></i></span>
            </div>
        </div>`;
    });
    grid.innerHTML = html;

    // 删除
    grid.querySelectorAll('.ggg-avatar-delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.avatarIndex);
            const img = avatarImages[idx];
            const { callGenericPopup, POPUP_TYPE } = SillyTavern.getContext();
            const confirmed = await callGenericPopup(`确定删除头像 "${img.name}" 吗？`, POPUP_TYPE.CONFIRM);
            if (!confirmed) return;
            if (img.filename) {
                try {
                    const headers = SillyTavern.getContext().getRequestHeaders();
                    await fetch('/api/backgrounds/delete', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ bg: img.filename }) });
                } catch (err) { console.warn('[ggg] 删除文件失败:', err); }
            }
            avatarImages.splice(idx, 1);
            const settings = getSettings();
            settings.avatars = avatarImages;
            saveAllSettings();
            refreshAvatarGrid();
            toastr.success(`已删除头像: ${img.name}`);
        });
    });

    // 标签
    grid.querySelectorAll('.ggg-avatar-tag-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.avatarIndex);
            await showAvatarTagPopup(idx);
        });
    });

    refreshAvatarTagFilter();
}

function refreshAvatarTagFilter() {
    const container = document.getElementById('ggg-avatar-tag-filter');
    if (!container) return;
    const allTags = new Set();
    avatarImages.forEach(img => { if (img.tags) img.tags.forEach(t => allTags.add(t)); });
    if (allTags.size === 0) { container.innerHTML = ''; return; }
    let html = '<div class="ggg-tag-bar">';
    [...allTags].sort().forEach(tag => {
        const isActive = avatarActiveTags.includes(tag);
        html += `<span class="ggg-tag-chip ${isActive ? 'active' : ''}" data-avatar-tag="${escapeAttr(tag)}">${escapeHtml(tag)}</span>`;
    });
    html += '</div>';
    container.innerHTML = html;
    container.querySelectorAll('.ggg-tag-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const tag = chip.dataset.avatarTag;
            const pos = avatarActiveTags.indexOf(tag);
            if (pos >= 0) avatarActiveTags.splice(pos, 1);
            else avatarActiveTags.push(tag);
            refreshAvatarGrid();
        });
    });
}

function initAvatarEvents() {
    document.getElementById('ggg-btn-upload-avatar')?.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = 'image/*'; input.multiple = true;
        input.addEventListener('change', async (e) => {
            const files = e.target.files;
            if (!files || files.length === 0) return;
            for (const file of files) {
                try { await uploadAvatar(file); } catch (err) { console.error('[ggg] 头像上传失败:', err); toastr.error(`上传失败: ${file.name}`); }
            }
            saveAllSettings();
            refreshAvatarGrid();
        });
        input.click();
    });
}

async function uploadAvatar(file) {
    const prefix = `ggg_avatar_${Date.now()}_`;
    const filename = prefix + file.name;
    const formData = new FormData();
    formData.append('avatar', file, filename);
    const headers = {};
    const origH = SillyTavern.getContext().getRequestHeaders();
    for (const [k, v] of Object.entries(origH)) {
        if (k.toLowerCase() !== 'content-type') headers[k] = v;
    }
    const resp = await fetch('/api/backgrounds/upload', { method: 'POST', headers, body: formData });
    if (!resp.ok) throw new Error(`上传失败: ${resp.status}`);
    const url = `/backgrounds/${filename}`;
    avatarImages.push({ name: file.name, url, filename, timestamp: Date.now(), tags: [] });
    const settings = getSettings();
    settings.avatars = avatarImages;
    toastr.success(`已上传头像: ${file.name}`);
    return url;
}

// ============================================================
// 头像拦截
// ============================================================
function initAvatarIntercept() {
    const interceptTargets = [
        '#add_avatar_button',
        '#avatar_upload_file',
        '#character_replace_file',
        '#group_avatar_button',
    ];

    interceptTargets.forEach(selector => {
        const el = document.querySelector(selector);
        if (!el) return;
        el.addEventListener('click', (e) => {
            if (avatarBypassing) return; // 放行标记，防止死循环
            if (avatarImages.length === 0) return; // 没有头像库时放行
            e.preventDefault();
            e.stopPropagation();
            showAvatarPicker(el);
        }, true);
    });

    // user 已有头像区域的 + 按钮也拦截
    const userAvatarBlock = document.getElementById('user_avatar_block');
    if (userAvatarBlock) {
        const observer = new MutationObserver(() => {
            // 对用户头像块中的点击头像请求做拦截 - 仅在打开文件选择器时
        });
    }
}

async function showAvatarPicker(targetInput) {
    const { callGenericPopup, POPUP_TYPE } = SillyTavern.getContext();

    // 收集所有头像标签
    const allAvatarTags = new Set();
    avatarImages.forEach(a => { if (a.tags) a.tags.forEach(t => allAvatarTags.add(t)); });
    const allTags = [...allAvatarTags].sort();
    let pickerFilterTags = [];

    let html = '<div class="ggg-avatar-picker-header">';
    html += '<span class="ggg-avatar-picker-title"><i class="ggg-fa fa-solid fa-user-circle"></i> 选择头像</span>';
    html += '<span class="ggg-avatar-picker-close" id="ggg-avatar-picker-close" title="关闭"><i class="ggg-fa fa-solid fa-xmark"></i></span>';
    html += '</div>';
    if (allTags.length > 0) {
        html += '<div id="ggg-avatar-picker-tag-filter" class="ggg-avatar-picker-tag-filter"></div>';
    }
    html += '<div style="max-height:400px;overflow-y:auto;">';
    html += '<div class="ggg-avatar-picker-grid" id="ggg-avatar-picker-grid"></div>';
    html += '</div>';

    let pickedIndex = -1;
    let closedByX = false;
    setTimeout(() => {
        function renderPickerTagFilter() {
            const filterEl = document.getElementById('ggg-avatar-picker-tag-filter');
            if (!filterEl || allTags.length === 0) return;
            let filterHTML = '<span class="ggg-tag-filter-label"><i class="ggg-fa fa-solid fa-filter"></i></span>';
            filterHTML += allTags.map(tag =>
                `<span class="ggg-tag-chip ${pickerFilterTags.includes(tag) ? 'active' : ''}" data-picker-tag="${escapeAttr(tag)}">${escapeHtml(tag)}</span>`
            ).join('');
            if (pickerFilterTags.length > 0) {
                filterHTML += '<span class="ggg-tag-chip ggg-tag-clear" data-picker-clear><i class="ggg-fa fa-solid fa-xmark"></i></span>';
            }
            filterEl.innerHTML = filterHTML;
            filterEl.querySelectorAll('[data-picker-tag]').forEach(chip => {
                chip.addEventListener('click', () => {
                    const tag = chip.dataset.pickerTag;
                    const idx = pickerFilterTags.indexOf(tag);
                    if (idx >= 0) pickerFilterTags.splice(idx, 1);
                    else pickerFilterTags.push(tag);
                    renderPickerTagFilter();
                    renderPickerGrid();
                });
            });
            filterEl.querySelector('[data-picker-clear]')?.addEventListener('click', () => {
                pickerFilterTags = [];
                renderPickerTagFilter();
                renderPickerGrid();
            });
        }

        function renderPickerGrid() {
            const gridEl = document.getElementById('ggg-avatar-picker-grid');
            if (!gridEl) return;
            let filtered = avatarImages;
            if (pickerFilterTags.length > 0) {
                filtered = avatarImages.filter(img => pickerFilterTags.every(t => img.tags?.includes(t)));
            }
            if (filtered.length === 0) {
                gridEl.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;opacity:0.5;">没有匹配的头像</div>';
                return;
            }
            let gridHTML = '';
            filtered.forEach((img) => {
                const realIdx = avatarImages.indexOf(img);
                const pickerTagsHtml = (img.tags && img.tags.length > 0)
                    ? `<div class="ggg-avatar-picker-tags">${img.tags.map(t => `<span class="ggg-avatar-picker-tag">${escapeHtml(t)}</span>`).join('')}</div>`
                    : '';
                gridHTML += `<div class="ggg-avatar-picker-item ${realIdx === pickedIndex ? 'selected' : ''}" data-avatar-pick-index="${realIdx}">
                    <div class="ggg-avatar-picker-thumb" style="background-image: url('${escapeAttr(img.url)}');"></div>
                    ${pickerTagsHtml}
                </div>`;
            });
            gridEl.innerHTML = gridHTML;
            gridEl.querySelectorAll('.ggg-avatar-picker-item').forEach(item => {
                item.addEventListener('click', () => {
                    gridEl.querySelectorAll('.ggg-avatar-picker-item').forEach(el => el.classList.remove('selected'));
                    item.classList.add('selected');
                    pickedIndex = parseInt(item.dataset.avatarPickIndex);
                });
            });
        }

        renderPickerTagFilter();
        renderPickerGrid();

        // 关闭按钮
        document.getElementById('ggg-avatar-picker-close')?.addEventListener('click', () => {
            closedByX = true;
            const overlay = document.querySelector('.popup:last-of-type .popup-button-cancel, .popup:last-of-type [data-result="0"]');
            if (overlay) overlay.click();
            else document.querySelector('.popup-button-cancel')?.click();
        });
    }, 100);

    const result = await callGenericPopup(html, POPUP_TYPE.CONFIRM, '', {
        okButton: '使用选中头像',
        cancelButton: '本地上传',
        wide: true,
        allowVerticalScrolling: true,
    });

    if (result && pickedIndex >= 0) {
        const avatar = avatarImages[pickedIndex];
        try {
            const response = await fetch(avatar.url);
            const blob = await response.blob();
            const file = new File([blob], avatar.filename || avatar.name, { type: blob.type });
            const dt = new DataTransfer();
            dt.items.add(file);
            targetInput.files = dt.files;
            targetInput.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (err) {
            console.error('[ggg] 头像选择失败:', err);
            toastr.error('头像选择失败');
        }
    } else if (!result && !closedByX) {
        avatarBypassing = true;
        setTimeout(() => {
            targetInput.click();
            setTimeout(() => {
                avatarBypassing = false;
            }, 500);
        }, 0);
    }
}

/** 头像标签管理弹窗（支持选择已有标签） */
async function showAvatarTagPopup(imgIndex) {
    const img = avatarImages[imgIndex];
    if (!img) return;

    // 收集所有头像已有的标签
    const allAvatarTags = new Set();
    avatarImages.forEach(a => { if (a.tags) a.tags.forEach(t => allAvatarTags.add(t)); });
    const allTags = [...allAvatarTags].sort();
    const imgTags = img.tags || [];
    let tempTags = [...imgTags];

    const html = `
        <div class="ggg-tag-popup">
            <div class="ggg-tag-popup-title">管理标签 - ${escapeHtml(img.name || '头像')}</div>
            <div class="ggg-tag-popup-preview" style="background-image: url('${escapeAttr(img.url)}')"></div>
            <div class="ggg-tag-popup-section">
                <div class="ggg-tag-popup-subtitle">已有标签（点击勾选/取消）</div>
                <div class="ggg-tag-popup-tags" id="ggg-avatar-tag-popup-existing">
                    ${allTags.length > 0 ? allTags.map(tag => `
                        <label class="ggg-tag-popup-chip">
                            <input type="checkbox" value="${escapeAttr(tag)}" ${imgTags.includes(tag) ? 'checked' : ''}>
                            <span>${escapeHtml(tag)}</span>
                        </label>
                    `).join('') : '<span style="opacity:0.5;font-size:0.85em;">暂无标签</span>'}
                </div>
            </div>
            <div class="ggg-tag-popup-section">
                <div class="ggg-tag-popup-subtitle">添加新标签</div>
                <div class="ggg-tag-popup-new-row">
                    <input type="text" id="ggg-avatar-tag-new-input" class="text_pole" placeholder="输入新标签名...">
                    <div id="ggg-avatar-tag-add-btn" class="menu_button menu_button_icon ggg-btn-small"><i class="ggg-fa fa-solid fa-plus"></i></div>
                </div>
            </div>
            <div class="ggg-tag-popup-section">
                <div class="ggg-tag-popup-subtitle">当前标签</div>
                <div id="ggg-avatar-tag-popup-current" class="ggg-tag-popup-current-tags"></div>
            </div>
        </div>
    `;

    const { callGenericPopup, POPUP_TYPE } = SillyTavern.getContext();

    setTimeout(() => {
        const currentTagsEl = document.getElementById('ggg-avatar-tag-popup-current');

        function renderCurrentTags() {
            if (!currentTagsEl) return;
            currentTagsEl.innerHTML = tempTags.length > 0
                ? tempTags.map(t => `<span class="ggg-tag-current-chip">${escapeHtml(t)} <i class="ggg-fa fa-solid fa-xmark ggg-avatar-tag-remove" data-tag="${escapeAttr(t)}"></i></span>`).join('')
                : '<span style="opacity:0.5;font-size:0.85em;">无标签</span>';

            currentTagsEl.querySelectorAll('.ggg-avatar-tag-remove').forEach(rm => {
                rm.addEventListener('click', () => {
                    const tag = rm.dataset.tag;
                    tempTags = tempTags.filter(t => t !== tag);
                    document.querySelectorAll('#ggg-avatar-tag-popup-existing input[type="checkbox"]').forEach(cb => {
                        if (cb.value === tag) cb.checked = false;
                    });
                    renderCurrentTags();
                });
            });
        }

        renderCurrentTags();

        // 已有标签勾选
        document.querySelectorAll('#ggg-avatar-tag-popup-existing input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => {
                const tag = cb.value;
                if (cb.checked) {
                    if (!tempTags.includes(tag)) tempTags.push(tag);
                } else {
                    tempTags = tempTags.filter(t => t !== tag);
                }
                renderCurrentTags();
            });
        });

        // 添加新标签
        const addBtn = document.getElementById('ggg-avatar-tag-add-btn');
        const addInput = document.getElementById('ggg-avatar-tag-new-input');

        function addNewTag() {
            if (!addInput) return;
            const val = addInput.value.trim();
            if (!val) return;
            if (!tempTags.includes(val)) {
                tempTags.push(val);
                renderCurrentTags();
            }
            addInput.value = '';
        }

        addBtn?.addEventListener('click', addNewTag);
        addInput?.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') { e.preventDefault(); addNewTag(); }
        });
        ['keyup', 'keypress', 'input'].forEach(evt => {
            addInput?.addEventListener(evt, (e) => e.stopPropagation());
        });
    }, 100);

    const result = await callGenericPopup(html, POPUP_TYPE.CONFIRM, '', {
        okButton: '保存',
        cancelButton: '取消',
        wide: false,
        allowVerticalScrolling: true,
    });

    if (result) {
        img.tags = [...tempTags];
        const settings = getSettings();
        settings.avatars = avatarImages;
        saveAllSettings();
        refreshAvatarGrid();
        toastr.success(`已更新标签: ${img.name || '头像'}`);
    }
}

// gallery events 补充
function initAvatarEventsLazy() {
    initAvatarEvents();
}
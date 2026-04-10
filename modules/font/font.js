/**
 * 字体管理模块
 * - 导入字体文件（ttf/otf/woff/woff2）上传到服务器
 * - 导入在线字体（@import / CSS URL）
 * - 字体列表管理（启用/禁用/删除）
 * - 使用范围选择（预设 + 自定义选择器）
 * - 字体大小调节
 * - 解析字体 name table 获取中/英文名
 */
import { getSettings, saveAllSettings, EXTENSION_NAME } from '../../index.js';

// 预设范围
const FONT_SCOPES = [
    { key: 'global', label: '全局', selector: 'body, button, input, select, textarea, #options a, ul, li, pre, code, .text_pole, #send_textarea, textarea.mdHotkeys, #send_textarea.mdHotkeys' },
    { key: 'chat', label: '聊天窗口', selector: '#chat' },
    { key: 'mes_text', label: '消息文字', selector: '.mes_text' },
    { key: 'name_text', label: '角色名称', selector: '.name_text' },
    { key: 'quote', label: '引用(q)', selector: 'q' },
    { key: 'em', label: '斜体(em)', selector: 'em' },
    { key: 'strong', label: '粗体(strong)', selector: 'strong' },
];

let fontSettings = { enabled: true, list: [] };
let expandedFontIndex = -1;

export function initFont() {
    const settings = getSettings();
    if (!settings.fonts) settings.fonts = { enabled: true, list: [] };
    fontSettings = settings.fonts;

    // 同步字体开关 UI
    const fontToggle = document.getElementById('ggg-toggle-font');
    if (fontToggle) {
        fontToggle.checked = fontSettings.enabled;
        fontToggle.addEventListener('change', (e) => {
            fontSettings.enabled = e.target.checked;
            const fontPanel = document.getElementById('ggg-font-panel');
            if (fontPanel) fontPanel.style.display = fontSettings.enabled ? '' : 'none';
            saveAllSettings();
            injectFontStyles();
        });
    }

    renderFontPanel();
    // 如果字体功能被禁用，隐藏面板
    if (!fontSettings.enabled) {
        const fontPanel = document.getElementById('ggg-font-panel');
        if (fontPanel) fontPanel.style.display = 'none';
    }
    injectFontStyles();
}

// ============================================================
// 字体 name table 解析（OpenType/TrueType）
// platformID=3(Windows), nameID=1(fontFamily)/4(fullName)
// languageID=2052 → 简体中文, languageID=1033 → 英文
// ============================================================
function parseFontNameTable(buffer) {
    const result = { zhName: '', enName: '' };
    try {
        const view = new DataView(buffer);
        const numTables = view.getUint16(4);
        let nameTableOffset = 0;

        for (let i = 0; i < numTables; i++) {
            const off = 12 + i * 16;
            const tag = String.fromCharCode(
                view.getUint8(off), view.getUint8(off + 1),
                view.getUint8(off + 2), view.getUint8(off + 3),
            );
            if (tag === 'name') {
                nameTableOffset = view.getUint32(off + 8);
                break;
            }
        }
        if (!nameTableOffset) return result;

        const count = view.getUint16(nameTableOffset + 2);
        const stringOffset = view.getUint16(nameTableOffset + 4);
        const storageOffset = nameTableOffset + stringOffset;

        for (let i = 0; i < count; i++) {
            const rec = nameTableOffset + 6 + i * 12;
            const platformID = view.getUint16(rec);
            const languageID = view.getUint16(rec + 4);
            const nameID = view.getUint16(rec + 6);
            const length = view.getUint16(rec + 8);
            const strOff = view.getUint16(rec + 10);

            if (platformID !== 3) continue;
            if (nameID !== 1 && nameID !== 4) continue;

            const strStart = storageOffset + strOff;
            if (strStart + length > buffer.byteLength) continue;

            let str = '';
            for (let j = 0; j < length; j += 2) {
                str += String.fromCharCode(view.getUint16(strStart + j));
            }

            if (languageID === 2052 && !result.zhName) result.zhName = str;
            else if (languageID === 1033 && !result.enName) result.enName = str;
        }
    } catch (e) {
        console.warn('[ggg] 字体名解析失败:', e);
    }
    return result;
}

// ============================================================
// 面板渲染
// ============================================================
function renderFontPanel() {
    const panel = document.getElementById('ggg-panel-font');
    if (!panel) return;

    panel.innerHTML = `
        <div id="ggg-font-panel">
            <div class="ggg-font-import-drawer">
                <div class="ggg-font-import-header">
                    <i class="ggg-fa fa-solid fa-chevron-right ggg-drawer-arrow"></i> 导入字体
                </div>
                <div class="ggg-font-import-body">
                    <div class="ggg-font-import-tabs">
                        <div class="ggg-font-import-tab active" data-import-tab="file"><i class="ggg-fa fa-solid fa-file"></i> 导入文件</div>
                        <div class="ggg-font-import-tab" data-import-tab="online"><i class="ggg-fa fa-solid fa-globe"></i> 导入在线字体</div>
                    </div>
                    <div class="ggg-font-import-panel active" data-import-panel="file">
                        <div style="font-size:0.75em;opacity:0.6;margin-bottom:6px;">支持 ttf / otf / woff / woff2 格式</div>
                        <div class="ggg-font-import-actions">
                            <div id="ggg-btn-upload-font" class="menu_button menu_button_icon ggg-btn-small"><i class="ggg-fa fa-solid fa-upload"></i> 选择字体文件</div>
                        </div>
                    </div>
                    <div class="ggg-font-import-panel" data-import-panel="online">
                        <div style="font-size:0.75em;opacity:0.6;margin-bottom:6px;">粘贴 @import url(...) 或 CSS 字体 URL</div>
                        <input type="text" class="ggg-font-url-input" id="ggg-font-url-input" placeholder="例如: @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC')">
                        <div class="ggg-font-import-actions">
                            <div id="ggg-btn-import-online" class="menu_button menu_button_icon ggg-btn-small"><i class="ggg-fa fa-solid fa-download"></i> 导入</div>
                        </div>
                    </div>
                </div>
            </div>
            <div id="ggg-font-list" class="ggg-font-list"></div>
            <div id="ggg-font-empty" class="ggg-font-empty">还没有导入任何字体</div>
        </div>`;

    bindFontEvents();
    refreshFontList();
}

function bindFontEvents() {
    const drawer = document.querySelector('.ggg-font-import-drawer');
    const drawerHeader = drawer?.querySelector('.ggg-font-import-header');
    if (drawerHeader) {
        drawerHeader.addEventListener('click', () => {
            drawer.classList.toggle('open');
            const arrow = drawerHeader.querySelector('.ggg-drawer-arrow');
            if (drawer.classList.contains('open')) { arrow.classList.remove('fa-chevron-right'); arrow.classList.add('fa-chevron-down'); }
            else { arrow.classList.remove('fa-chevron-down'); arrow.classList.add('fa-chevron-right'); }
        });
    }

    document.querySelectorAll('.ggg-font-import-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.ggg-font-import-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.ggg-font-import-panel').forEach(p => p.classList.remove('active'));
            document.querySelector(`.ggg-font-import-panel[data-import-panel="${tab.dataset.importTab}"]`)?.classList.add('active');
        });
    });

    // 上传字体文件
    document.getElementById('ggg-btn-upload-font')?.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.ttf,.otf,.woff,.woff2';
        input.multiple = true;
        input.addEventListener('change', async (e) => {
            const files = e.target.files;
            if (!files || files.length === 0) return;
            for (const file of files) {
                try { await uploadFontFile(file); } catch (err) { console.error('[ggg] 字体上传失败:', err); toastr.error(`上传失败: ${file.name}`); }
            }
            saveAllSettings();
            refreshFontList();
            injectFontStyles();
        });
        input.click();
    });

    // 导入在线字体（async）
    document.getElementById('ggg-btn-import-online')?.addEventListener('click', async () => {
        const input = document.getElementById('ggg-font-url-input');
        const val = input?.value?.trim();
        if (!val) { toastr.info('请输入字体 URL 或 @import 语句'); return; }
        await importOnlineFont(val);
        input.value = '';
        saveAllSettings();
        refreshFontList();
        injectFontStyles();
    });

    const urlInput = document.getElementById('ggg-font-url-input');
    if (urlInput) ['keydown','keyup','keypress','input'].forEach(evt => urlInput.addEventListener(evt, e => e.stopPropagation()));
}

// ============================================================
// 字体上传
// ============================================================
async function uploadFontFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['ttf', 'otf', 'woff', 'woff2'].includes(ext)) { toastr.error('不支持的字体格式'); return; }

    // 解析 name table 获取中英文名
    const arrayBuffer = await file.arrayBuffer();
    const nameInfo = parseFontNameTable(arrayBuffer);

    // 默认名称：优先中文名 → 英文名 → 文件名
    const baseName = file.name.replace(/\.(ttf|otf|woff2?)$/i, '');
    const defaultName = nameInfo.zhName || nameInfo.enName || baseName;

    // 让用户确认/修改字体名称
    const { callGenericPopup, POPUP_TYPE } = SillyTavern.getContext();
    const userName = await callGenericPopup('请输入字体名称：', POPUP_TYPE.INPUT, defaultName, { rows: 1 });
    if (userName === null || userName === undefined) return;
    const finalName = (userName.trim() || defaultName);

    // 上传文件
    const prefix = `ggg_font_${Date.now()}_`;
    const filename = prefix + file.name.replace(/\s+/g, '_');
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
    // 稳定的 @font-face 名：基于文件名
    const fontFaceName = `ggg-local-${baseName.replace(/[^a-zA-Z0-9\u4e00-\u9fff-]/g, '_')}`;

    fontSettings.list.push({
        id: `font_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        name: finalName,
        zhName: nameInfo.zhName || '',
        enName: nameInfo.enName || '',
        fontFaceName: fontFaceName,
        type: 'file',
        src: url,
        filename: filename,
        format: ext === 'ttf' ? 'truetype' : ext === 'otf' ? 'opentype' : ext,
        enabled: true,
        scopes: ['global'],
        customSelector: '',
        fontSize: null,
    });

    toastr.success(`已上传字体: ${finalName}`);
}

async function importOnlineFont(input) {
    let importUrl = input;
    let fontName = '';

    const importMatch = input.match(/@import\s+url\s*\(\s*['"]?(.*?)['"]?\s*\)/i);
    if (importMatch) importUrl = importMatch[1];

    importUrl = importUrl.replace(/^['"]|['"]$/g, '').trim();
    if (!importUrl.startsWith('http') && !importUrl.startsWith('//')) {
        toastr.error('请输入有效的字体 URL'); return;
    }

    // 自动 fetch CSS 提取真实 font-family
    try {
        const resp = await fetch(importUrl);
        if (resp.ok) {
            const cssText = await resp.text();
            // 提取所有 @font-face 中的 font-family
            const ffMatches = cssText.matchAll(/@font-face\s*\{([^}]*)\}/gi);
            for (const ffMatch of ffMatches) {
                const familyMatch = ffMatch[1].match(/font-family:\s*['"]?([^'";\n}]+?)['"]?\s*[;\n}]/i);
                if (familyMatch) {
                    fontName = familyMatch[1].trim();
                    break;
                }
            }
            if (fontName) {
                console.log('[ggg] 从 CSS 中提取到字体名:', fontName);
            }
        }
    } catch (e) {
        console.warn('[ggg] 无法获取在线字体CSS:', e);
    }

    // 后备：从 Google Fonts URL 提取（支持 family=Noto+Sans+SC 格式）
    if (!fontName) {
        const familyMatch = importUrl.match(/family=([^&:]+)/i);
        if (familyMatch) fontName = decodeURIComponent(familyMatch[1]).replace(/\+/g, ' ').trim();
    }
    if (!fontName) fontName = '在线字体';

    fontSettings.list.push({
        id: `font_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        name: fontName,
        fontFaceName: fontName,
        type: 'online',
        src: importUrl,
        enabled: true,
        scopes: ['global'],
        customSelector: '',
        fontSize: null,
    });

    console.log('[ggg] 在线字体已导入:', { fontName, importUrl });
    toastr.success(`已导入在线字体: ${fontName}`);
}

// ============================================================
// 获取字体的 CSS font-family（带引号）
// ============================================================
function getFontFamily(font) {
    if (font.type === 'file') {
        return `'${font.fontFaceName || `ggg-${font.id}`}'`;
    }
    return `'${font.fontFaceName || font.name}'`;
}

// ============================================================
// 字体列表渲染
// ============================================================
function refreshFontList() {
    const list = document.getElementById('ggg-font-list');
    const empty = document.getElementById('ggg-font-empty');
    if (!list) return;

    if (fontSettings.list.length === 0) {
        list.innerHTML = ''; list.style.display = 'none';
        if (empty) empty.style.display = '';
        return;
    }
    list.style.display = ''; if (empty) empty.style.display = 'none';

    let html = '';
    fontSettings.list.forEach((font, i) => {
        const isExpanded = i === expandedFontIndex;
        const typeLabel = font.type === 'file' ? '本地' : '在线';
        const previewFont = getFontFamily(font);
        // 显示名优先中文名
        const displayName = font.zhName || font.name;
        html += `<div class="ggg-font-item" data-font-index="${i}">
            <div class="ggg-font-item-name">
                <span>${escapeHtml(displayName)}</span>
                <span class="ggg-font-item-type">${typeLabel}</span>
            </div>
            <span class="ggg-font-item-preview" style="font-family: ${previewFont}, sans-serif;">${escapeHtml(displayName)}</span>
            <div class="ggg-font-item-actions">
                <input type="checkbox" class="ggg-font-enable-check" data-font-index="${i}" ${font.enabled ? 'checked' : ''} title="启用/禁用">
                <span class="ggg-text-btn ggg-font-settings-btn" data-font-index="${i}" title="设置"><i class="ggg-fa fa-solid fa-gear"></i></span>
                <span class="ggg-text-btn ggg-font-delete-btn" data-font-index="${i}" title="删除"><i class="ggg-fa fa-solid fa-trash"></i></span>
            </div>
        </div>`;

        if (isExpanded) html += buildFontSettingsPanel(font, i);
    });
    list.innerHTML = html;
    bindFontListEvents();
}

function buildFontSettingsPanel(font, index) {
    const scopes = font.scopes || [];
    const hasCustom = !!font.customSelector;

    let scopeChips = '';
    FONT_SCOPES.forEach(scope => {
        scopeChips += `<div class="ggg-font-scope-chip ${scopes.includes(scope.key) ? 'active' : ''}" data-scope-key="${scope.key}" data-font-index="${index}">${scope.label}</div>`;
    });

    const fontSize = font.fontSize || { value: '', unit: 'px' };

    return `<div class="ggg-font-scope-section" data-font-settings="${index}">
        <div class="ggg-font-scope-title">
            <span>使用范围</span>
            <span class="ggg-text-btn ggg-font-advanced-toggle" data-font-index="${index}" title="高级模式">${hasCustom ? '◆ 高级' : '○ 高级'}</span>
        </div>
        <div class="ggg-font-scope-grid">${scopeChips}</div>
        <input type="text" class="ggg-font-custom-selector" data-font-index="${index}" placeholder="自定义CSS选择器，如: .my-class, #my-id" value="${escapeAttr(font.customSelector || '')}" style="${hasCustom ? '' : 'display:none;'}">
        <div class="ggg-font-size-section">
            <span class="ggg-font-size-label">字体大小:</span>
            <input type="number" class="ggg-font-size-input" data-font-index="${index}" value="${fontSize.value || ''}" placeholder="默认" min="1" max="200" step="1">
            <select class="ggg-font-size-unit" data-font-index="${index}">
                <option value="px" ${(fontSize.unit || 'px') === 'px' ? 'selected' : ''}>px</option>
                <option value="em" ${fontSize.unit === 'em' ? 'selected' : ''}>em</option>
            </select>
        </div>
    </div>`;
}

function bindFontListEvents() {
    document.querySelectorAll('.ggg-font-enable-check').forEach(cb => {
        cb.addEventListener('change', () => {
            const idx = parseInt(cb.dataset.fontIndex);
            fontSettings.list[idx].enabled = cb.checked;
            saveAllSettings(); injectFontStyles();
        });
    });

    document.querySelectorAll('.ggg-font-settings-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.fontIndex);
            expandedFontIndex = expandedFontIndex === idx ? -1 : idx;
            refreshFontList();
        });
    });

    document.querySelectorAll('.ggg-font-delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const idx = parseInt(btn.dataset.fontIndex);
            const font = fontSettings.list[idx];
            const { callGenericPopup, POPUP_TYPE } = SillyTavern.getContext();
            const confirmed = await callGenericPopup(`确定删除字体 "${font.zhName || font.name}" 吗？`, POPUP_TYPE.CONFIRM);
            if (!confirmed) return;

            if (font.type === 'file' && font.filename) {
                try {
                    const headers = SillyTavern.getContext().getRequestHeaders();
                    await fetch('/api/backgrounds/delete', {
                        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ bg: font.filename }),
                    });
                } catch (err) { console.warn('[ggg] 删除文件失败:', err); }
            }


            fontSettings.list.splice(idx, 1);
            if (expandedFontIndex === idx) expandedFontIndex = -1;
            else if (expandedFontIndex > idx) expandedFontIndex--;
            saveAllSettings(); refreshFontList(); injectFontStyles();
            toastr.success(`已删除字体: ${font.zhName || font.name}`);
        });
    });

    document.querySelectorAll('.ggg-font-scope-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const idx = parseInt(chip.dataset.fontIndex);
            const key = chip.dataset.scopeKey;
            const font = fontSettings.list[idx];
            if (!font.scopes) font.scopes = [];
            const pos = font.scopes.indexOf(key);
            if (pos >= 0) font.scopes.splice(pos, 1);
            else font.scopes.push(key);
            chip.classList.toggle('active');
            saveAllSettings(); injectFontStyles();
        });
    });

    document.querySelectorAll('.ggg-font-advanced-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.fontIndex);
            const input = document.querySelector(`.ggg-font-custom-selector[data-font-index="${idx}"]`);
            if (input) {
                const isVisible = input.style.display !== 'none';
                input.style.display = isVisible ? 'none' : '';
                btn.textContent = isVisible ? '○ 高级' : '◆ 高级';
            }
        });
    });

    document.querySelectorAll('.ggg-font-custom-selector').forEach(input => {
        ['keydown','keyup','keypress','input'].forEach(evt => input.addEventListener(evt, e => e.stopPropagation()));
        input.addEventListener('change', () => {
            const idx = parseInt(input.dataset.fontIndex);
            fontSettings.list[idx].customSelector = input.value.trim();
            saveAllSettings(); injectFontStyles();
        });
    });

    document.querySelectorAll('.ggg-font-size-input').forEach(input => {
        ['keydown','keyup','keypress','input'].forEach(evt => input.addEventListener(evt, e => e.stopPropagation()));
        input.addEventListener('change', () => {
            const idx = parseInt(input.dataset.fontIndex);
            const val = input.value.trim();
            const unit = document.querySelector(`.ggg-font-size-unit[data-font-index="${idx}"]`)?.value || 'px';
            fontSettings.list[idx].fontSize = val ? { value: parseFloat(val), unit } : null;
            saveAllSettings(); injectFontStyles();
        });
    });

    document.querySelectorAll('.ggg-font-size-unit').forEach(select => {
        select.addEventListener('change', () => {
            const idx = parseInt(select.dataset.fontIndex);
            const input = document.querySelector(`.ggg-font-size-input[data-font-index="${idx}"]`);
            const val = input?.value?.trim();
            if (val) {
                fontSettings.list[idx].fontSize = { value: parseFloat(val), unit: select.value };
                saveAllSettings(); injectFontStyles();
            }
        });
    });
}

// ============================================================
// 字体服务插件端点
// ============================================================
const FONT_PLUGIN_ENDPOINT = '/api/plugins/ggg-font-server/font/';
const FONT_PLUGIN_STATUS = '/api/plugins/ggg-font-server/status';

// 缓存插件是否可用的状态（避免每次都发请求检测）
let fontPluginAvailable = null; // null = 未检测, true/false = 已检测

/** 检查字体服务插件是否已安装并可用 */
async function checkFontPlugin() {
    if (fontPluginAvailable !== null) return fontPluginAvailable;
    try {
        const resp = await fetch(FONT_PLUGIN_STATUS);
        if (resp.ok) {
            const data = await resp.json();
            fontPluginAvailable = data.ok === true;
        } else {
            fontPluginAvailable = false;
        }
    } catch {
        fontPluginAvailable = false;
    }
    console.log('[ggg] 字体服务插件状态:', fontPluginAvailable ? '可用 ✓' : '不可用 ✗');
    if (!fontPluginAvailable) {
        console.warn('[ggg] 字体服务插件未安装。本地字体可能无法正常显示。');
        console.warn('[ggg] 请将 server-plugin 文件夹复制到 SillyTavern/plugins/ggg-font-server/ 并在 config.yaml 中启用 enableServerPlugins: true');
    }
    return fontPluginAvailable;
}

/** 获取本地字体的 URL（优先使用插件端点） */
function getLocalFontUrl(font) {
    if (fontPluginAvailable && font.filename) {
        // 通过插件端点获取，该端点会设置正确的 MIME 和 CORS 头
        return FONT_PLUGIN_ENDPOINT + encodeURIComponent(font.filename);
    }
    // 回退到直接路径（可能因 MIME 类型问题导致字体不显示）
    return font.src;
}

// ============================================================
// 样式注入
// ============================================================
async function injectFontStyles() {
    let styleEl = document.getElementById('ggg-fonts');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'ggg-fonts';
        document.head.appendChild(styleEl);
    }

    // 清理旧的在线字体 <link> 元素
    document.querySelectorAll('link[data-ggg-font]').forEach(el => el.remove());

    if (!fontSettings.enabled) { styleEl.textContent = ''; return; }

    // 首次调用时检测插件是否可用
    await checkFontPlugin();

    let fontFaces = '';
    let rules = '';

    fontSettings.list.forEach(font => {
        if (font.type === 'file') {
            // 本地字体：通过 @font-face 声明，使用插件端点获取正确 MIME 类型
            const faceName = font.fontFaceName || `ggg-${font.id}`;
            const fontUrl = getLocalFontUrl(font);
            fontFaces += `@font-face { font-family: '${faceName}'; src: url('${fontUrl}') format('${font.format || 'truetype'}'); font-display: swap; }\n`;
        } else if (font.type === 'online') {
            // 在线字体：使用 <link> 元素加载
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = font.src;
            link.setAttribute('data-ggg-font', font.id);
            document.head.appendChild(link);
        }

        if (!font.enabled) return;

        const selectors = [];
        if (font.scopes) {
            font.scopes.forEach(scopeKey => {
                const scope = FONT_SCOPES.find(s => s.key === scopeKey);
                if (scope) selectors.push(scope.selector);
            });
        }
        if (font.customSelector) selectors.push(font.customSelector);
        if (selectors.length === 0) return;

        const fontFamily = getFontFamily(font);
        const sizeCSS = font.fontSize && font.fontSize.value ? `font-size: ${font.fontSize.value}${font.fontSize.unit || 'px'} !important;` : '';

        rules += `${selectors.join(', ')} { font-family: ${fontFamily}, sans-serif !important; ${sizeCSS} }\n`;
    });

    styleEl.textContent = fontFaces + rules;
    console.log('[ggg] 字体样式已注入:', {
        pluginAvailable: fontPluginAvailable,
        fontFaces: fontFaces.length > 0,
        rules: rules.length > 0,
        linkCount: document.querySelectorAll('link[data-ggg-font]').length,
    });
}

// ============================================================
// 工具
// ============================================================
function escapeHtml(str) { if (!str) return ''; const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
function escapeAttr(str) { if (!str) return ''; return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#039;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

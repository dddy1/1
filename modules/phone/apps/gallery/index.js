/**
 * 图库 App —— 三个 Tab：
 *   - 酒馆背景：读取 SillyTavern 的 backgrounds（/api/backgrounds 列表）
 *   - 呱呱图库：读 settings.gallery（呱呱小工具自带的图库）
 *   - 聊天图片：占位（后续生图 / 图片消息保存到这里）
 *
 * 当前为骨架，能渲染 Tab 切换，列表读不到也优雅 fallback。
 */

import { settings } from '../../../../index.js';

export function createGalleryComponent(Vue) {
    const { ref, onMounted } = Vue;

    return Vue.defineComponent({
        name: 'PhoneGallery',
        props: {
            onBack: { type: Function, required: true },
        },
        setup(props) {
            const tab = ref('st-bg');
            const stBgs = ref([]);   // 酒馆背景
            const gggImgs = ref([]); // 呱呱图库
            const chatImgs = ref([]); // 聊天图片（暂占位）

            const loadStBgs = async () => {
                try {
                    const ctx = SillyTavern.getContext?.();
                    const headers = ctx?.getRequestHeaders?.() || {};
                    const r = await fetch('/api/backgrounds/all', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', ...headers },
                    });
                    if (!r.ok) throw new Error(`HTTP ${r.status}`);
                    const list = await r.json();
                    // 返回的是文件名数组，拼接成 url
                    stBgs.value = (Array.isArray(list) ? list : []).map(f => ({
                        name: f,
                        url: `/backgrounds/${encodeURIComponent(f)}`,
                    }));
                } catch (e) {
                    console.warn('[ggg-phone] 读取酒馆背景失败：', e);
                    stBgs.value = [];
                }
            };

            const loadGggImgs = () => {
                gggImgs.value = (settings.gallery || []).map(item => ({
                    name: item.name || item.id || '',
                    url: item.url || item.dataUrl || '',
                }));
            };

            onMounted(() => {
                loadStBgs();
                loadGggImgs();
            });

            const tabs = [
                { id: 'st-bg', name: '酒馆背景' },
                { id: 'ggg', name: '呱呱图库' },
                { id: 'chat', name: '聊天图片' },
            ];

            const activeList = Vue.computed(() => {
                if (tab.value === 'st-bg') return stBgs.value;
                if (tab.value === 'ggg') return gggImgs.value;
                return chatImgs.value;
            });

            return { tab, tabs, activeList, onBack: props.onBack };
        },
        template: /* html */ `
            <div class="ggg-phone-app ggg-phone-gallery">
                <div class="ggg-phone-app-topbar">
                    <button class="ggg-phone-iconbtn" @click="onBack" aria-label="返回">
                        <i class="ggg-fa fa-solid fa-chevron-left"></i>
                    </button>
                    <div class="ggg-phone-app-title">图库</div>
                    <div class="ggg-phone-iconbtn placeholder"></div>
                </div>

                <div class="ggg-phone-tabs">
                    <div
                        v-for="t in tabs"
                        :key="t.id"
                        class="ggg-phone-tab"
                        :class="{ active: tab === t.id }"
                        @click="tab = t.id">
                        {{ t.name }}
                    </div>
                </div>

                <div class="ggg-phone-gallery-grid">
                    <div v-if="activeList.length === 0" class="ggg-phone-gallery-empty">
                        暂无图片
                    </div>
                    <div
                        v-for="img in activeList"
                        :key="img.name"
                        class="ggg-phone-gallery-cell"
                        :title="img.name">
                        <img :src="img.url" :alt="img.name" loading="lazy" />
                    </div>
                </div>
            </div>
        `,
    });
}

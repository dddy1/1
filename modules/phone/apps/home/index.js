/**
 * 主页（Home）—— Vue 组件
 * 布局（垂直 flex）：
 *   时间小组件（两行四列）
 *   第一行 [PP/小呱书/图库/设置 2x2] | [收藏小组件]
 *   第二行 [音乐小组件]               | [生图/OG/GO3/电话 2x2]
 */

// 8 个 APP（按布局顺序：第一行 2x2 共 4 个，第二行 2x2 共 4 个）
export const APPS = [
    // 第一行 2x2
    { id: 'pp', name: 'PP', icon: 'fa-comments', color: '#3b82f6', enabled: false },
    { id: 'notebook', name: '小呱书', icon: 'fa-book-open', color: '#ec4899', enabled: false },
    { id: 'gallery', name: '图库', icon: 'fa-images', color: '#06b6d4', enabled: true },
    { id: 'settings', name: '设置', icon: 'fa-gear', color: '#64748b', enabled: false },
    // 第二行 2x2
    { id: 'image-gen', name: '生图', icon: 'fa-image', color: '#a855f7', enabled: false },
    { id: 'og', name: 'OG', icon: 'fa-circle-nodes', color: '#10b981', enabled: false },
    { id: 'go3', name: 'GO3', icon: 'fa-gamepad', color: '#f59e0b', enabled: false },
    { id: 'phone-call', name: '电话', icon: 'fa-phone', color: '#22c55e', enabled: false },
];

export function createHomeComponent(Vue) {
    const { ref, onMounted, onBeforeUnmount } = Vue;

    return Vue.defineComponent({
        name: 'PhoneHome',
        props: {
            onOpenApp: { type: Function, required: true },
        },
        setup(props) {
            const now = ref(new Date());
            let timer = null;
            onMounted(() => { timer = setInterval(() => now.value = new Date(), 1000 * 30); });
            onBeforeUnmount(() => { if (timer) clearInterval(timer); });

            const pad = (n) => String(n).padStart(2, '0');
            const fmtHM = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
            const fmtWeek = (d) => ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
            const fmtMD = (d) => `${d.getMonth() + 1}/${d.getDate()}`;

            const onAppTap = (app) => {
                if (!app.enabled) {
                    console.log('[ggg-phone] APP 占位中：', app.id);
                    return;
                }
                props.onOpenApp(app.id);
            };

            return {
                now, fmtHM, fmtWeek, fmtMD,
                appsTopRight: APPS.slice(0, 4),
                appsBottomRight: APPS.slice(4, 8),
                onAppTap,
            };
        },
        template: /* html */ `
            <div class="ggg-phone-home">
                <!-- 时间小组件：两行四列 -->
                <div class="ggg-phone-widget ggg-phone-widget-time">
                    <div class="t-cell t-time">{{ fmtHM(now) }}</div>
                    <div class="t-cell t-week">{{ fmtWeek(now) }}</div>
                    <div class="t-cell t-date">{{ fmtMD(now) }}</div>
                    <div class="t-cell t-info">农历 -</div>
                    <div class="t-cell t-info">晴</div>
                    <div class="t-cell t-info">22°</div>
                    <div class="t-cell t-info">杭州</div>
                </div>

                <!-- 第一行：左 2x2 APP + 右 收藏小组件 -->
                <div class="ggg-phone-row">
                    <div class="ggg-phone-app-quad">
                        <div
                            v-for="app in appsTopRight"
                            :key="app.id"
                            class="ggg-phone-app-cell"
                            :class="{ disabled: !app.enabled }"
                            @click="onAppTap(app)">
                            <div class="ggg-phone-app-icon" :style="{ background: app.color }">
                                <i class="ggg-fa fa-solid" :class="app.icon"></i>
                            </div>
                            <div class="ggg-phone-app-name">{{ app.name }}</div>
                        </div>
                    </div>
                    <div class="ggg-phone-widget ggg-phone-widget-fav">
                        <div class="ggg-phone-widget-title">
                            <i class="ggg-fa fa-solid fa-star"></i> 收藏消息
                        </div>
                        <div class="ggg-phone-widget-empty">暂无收藏</div>
                    </div>
                </div>

                <!-- 第二行：左 音乐小组件 + 右 2x2 APP -->
                <div class="ggg-phone-row">
                    <div class="ggg-phone-widget ggg-phone-widget-music">
                        <div class="ggg-phone-widget-title">
                            <i class="ggg-fa fa-solid fa-music"></i> 音乐
                        </div>
                        <div class="ggg-phone-widget-empty">暂无播放</div>
                    </div>
                    <div class="ggg-phone-app-quad">
                        <div
                            v-for="app in appsBottomRight"
                            :key="app.id"
                            class="ggg-phone-app-cell"
                            :class="{ disabled: !app.enabled }"
                            @click="onAppTap(app)">
                            <div class="ggg-phone-app-icon" :style="{ background: app.color }">
                                <i class="ggg-fa fa-solid" :class="app.icon"></i>
                            </div>
                            <div class="ggg-phone-app-name">{{ app.name }}</div>
                        </div>
                    </div>
                </div>
            </div>
        `,
    });
}

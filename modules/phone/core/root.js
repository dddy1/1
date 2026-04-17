/**
 * 手机根组件 —— 极简路由（栈式）
 * 维护 viewStack：['home', 'gallery', ...]
 * 提供 openApp / back 给子组件
 *
 * 这里先支持的 App：home / gallery
 * 后续 App 在 APP_MAP 注册即可
 */

import { createHomeComponent } from '../apps/home/index.js';
import { createGalleryComponent } from '../apps/gallery/index.js';

export function createPhoneRoot(Vue) {
    const { ref, computed } = Vue;

    const Home = createHomeComponent(Vue);
    const Gallery = createGalleryComponent(Vue);

    // App id → 组件
    const APP_MAP = {
        home: Home,
        gallery: Gallery,
    };

    return Vue.defineComponent({
        name: 'PhoneRoot',
        components: APP_MAP,
        setup() {
            const stack = ref(['home']);

            const current = computed(() => stack.value[stack.value.length - 1]);
            const currentComp = computed(() => APP_MAP[current.value] || Home);

            const openApp = (id) => {
                if (!APP_MAP[id]) {
                    console.warn('[ggg-phone] App 未注册：', id);
                    return;
                }
                stack.value = [...stack.value, id];
            };
            const back = () => {
                if (stack.value.length > 1) {
                    stack.value = stack.value.slice(0, -1);
                }
            };

            return { current, currentComp, openApp, back };
        },
        template: /* html */ `
            <component
                :is="currentComp"
                :on-open-app="openApp"
                :on-back="back" />
        `,
    });
}

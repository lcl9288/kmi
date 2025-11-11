import type { HmrContext, Plugin } from '../../../compiled/vite';

export default function handleHotUpdate(
  listener: (modules: HmrContext['modules']) => Promise<void> | void,
): Plugin {
  return {
    name: 'vite-plugin-umi-on-hot-update',
    apply: 'serve',
    async handleHotUpdate(ctx: HmrContext) {
      await listener(ctx.modules);
      // 返回受影响的模块，让 Vite 继续处理 HMR
      // 如果不返回，Vite 会触发 full-reload
      return ctx.modules;
    },
  };
}

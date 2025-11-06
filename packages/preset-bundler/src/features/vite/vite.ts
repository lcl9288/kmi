import assert from 'node:assert'
import type { StatsCompilation } from '@kmijs/bundler-shared/rspack'
import { fsExtra, logger, pathe, picocolors } from '@kmijs/shared'
import { BundlerTypeEnum, type IApi } from '@kmijs/types'
import { CORE_JS_DIR } from '../../constants'
import { bundlerRspack, bundlerVite } from '../../utils/bundler'
import { prettyTime } from '../../utils/prettyTime'
import { applyCheckConfig } from './checkConfig'

export default (api: IApi) => {
  api.describe({
    key: 'vite6',
    config: {
      schema({ zod }) {
        return zod
          .object({
            useBabel: zod.boolean().optional().describe('启动 babel 编译'),
          })
          .partial()
      },
    },
    enableBy: api.EnableBy.config,
  })

  api.onCheckConfig(({ config }) => {
    // 禁用 mako 提示
    process.env.MAKO_AD = 'none'

    assert(!config.vite, 'vite6 cannot be used together with vite.')
    assert(!config.mako, 'vite6 cannot be used together with mako.')
    assert(!config.rspack, 'vite6 cannot be used together with rspack.')
  })

  // api.modifyConfig((memo) => {
  //   memo.mfsu = false

  //   memo.rspack = {
  //     ...memo.rspack,
  //     // support modify babel config
  //     __babelLoaderOptions(ctx: BabelLoaderOptions, args: BabelConfigUtils) {
  //       api.applyPlugins({
  //         key: 'modifyRspackBabelLoaderOptions',
  //         type: api.ApplyPluginsType.modify,
  //         initialValue: ctx,
  //         args: args,
  //       })
  //     },
  //   }
  //   return memo
  // })

  api.modifyAppData((memo) => {
    memo.bundler = BundlerTypeEnum.vite6
    memo.viteVersion = bundlerVite.version
    memo.bundlerInfo = {
      ...memo.bundlerInfo,
      version: bundlerVite.version,
      viteVersion: bundlerVite.version,
    }
    return memo
  })

  api.onStart(() => {
    if (['dev', 'build'].includes(api.name)) {
      logger.info(
        `Using ${picocolors.green('Rspack')} v${bundlerRspack.rspackVersion}`,
      )
    }
  })

  api.modifyUniBundlerOpts(async (memo, { bundler }) => {
    const modifyViteConfig = async (memo: any, args: any) => {
      return await api.applyPlugins({
        key: 'modifyViteConfig',
        initialValue: memo,
        args,
      })
    }
    memo.modifyViteConfig = modifyViteConfig
    // 参考umi，在vite6启用时，禁用babel webpack相关配置umi/packages/preset-umi/src/commands/dev/dev.ts
    // vite6启用时，禁用babel webpack相关配置
    memo.babbelPreset = undefined
    memo.chainWebpack = undefined
    memo.modifyWebpackConfig = undefined

    // memo.afterMiddlewares = []

    return memo
  })

  api.onBuildComplete(({ err, stats }) => {
    const hasErrors = stats.hasErrors()
    if (!err && !hasErrors) {
      const statsJson = stats.toJson({
        children: true,
        moduleTrace: true,
        timings: true,
        preset: 'errors-warnings',
      })

      // @ts-expect-error
      printTime(statsJson)
    }
  })

  api.onBuildComplete(async ({ err }) => {
    if (err && api.userConfig.forkTSChecker) {
      // rspack's type checking output will continue to be generated, to avoid interfering with subsequent processes, manually remove the file if it exists
      const absOutputPath = pathe.join(api.cwd, api.appData.outputPath)
      if (await fsExtra.exists(absOutputPath)) {
        await fsExtra.remove(absOutputPath)
      }
    }
  })

  api.register({
    key: 'onBeforeCompiler',
    stage: Number.POSITIVE_INFINITY,
    async fn() {
      await api.applyPlugins({
        key: 'updateAppDataDeps',
        type: api.ApplyPluginsType.event,
      })
    },
  })

  api.bundlerChain((memo) => {
    if (process.env.LOCK_CORE_JS !== 'none') {
      memo.resolve.alias.set('core-js', CORE_JS_DIR)
    }
    return memo
  })

  api.modifyConfig((memo) => {
    // like vite, use to pre-bundling dependencies in vite mode
    memo.alias['@fs'] = api.cwd
    return memo
  })

  api.modifyDefaultConfig((memo) => {
    // vite development env disable polyfill optimise dev development experience
    if (api.env === 'development') {
      memo.polyfill = false
    }

    return memo
  })

  // include extra monorepo package deps for vite pre-bundle
  api.modifyViteConfig((memo) => {
    logger.info('[debug] api.appData.deps!', JSON.stringify(api.appData))
    memo.optimizeDeps = {
      ...(memo.optimizeDeps || {}),
      include: memo.optimizeDeps?.include?.concat(
        Object.values(api.appData.deps!)
          .map(({ matches }) => matches[0])
          .filter(
            (item) =>
              item?.startsWith('@fs') && !item?.includes('node_modules'),
          ),
      ),
    }
    // memo.plugins?.push(ViteHtmlPlugin(api))

    return memo
  })

  applyCheckConfig(api)
}

const printTime = (c: StatsCompilation) => {
  if (c.time) {
    const time = prettyTime(c.time / 1000)
    logger.info(picocolors.green(`Compiled successfully in ${time}`))
  }
}

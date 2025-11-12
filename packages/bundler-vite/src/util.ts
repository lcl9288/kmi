import path from 'node:path'

function winPath(p: string) {
  return p.replace(/\\/g, '/')
}

export function toWebpackLikeStats(rollupResult, timeMs: number, cwd: string) {
  const results = Array.isArray(rollupResult) ? rollupResult : [rollupResult]

  const assets: Array<{ name: string; size: number }> = []
  const chunks: Array<{ names: string[]; files: string[]; size: number }> = []
  const assetsByChunkName: Record<string, string[] | string> = []
  const warnings: any[] = []
  const errors: any[] = []
  const compilationAssets: Record<
    string,
    {
      // 保持与 webpack 结构兼容，实际调用场景仅用到了 key
      size?: () => number
    }
  > = {}

  for (const res of results) {
    for (const item of res.output) {
      if (item.type === 'asset') {
        const size =
          typeof item.source === 'string'
            ? Buffer.byteLength(item.source)
            : item.source?.length ?? 0
        assets.push({ name: item.fileName, size })
        // for webpack-like stats.compilation.assets keys
        compilationAssets[item.fileName] = compilationAssets[item.fileName] || {
          size: () => size,
        }
      } else {
        const size = Buffer.byteLength(item.code || '')
        // 计算 origins：基于模块 ID 列表生成相对 cwd 的 moduleName，以及相对每个模块自身目录的 request
        const modules = (item as any).modules || {}
        const moduleIds: string[] = Array.isArray((item as any).moduleIds)
          ? ((item as any).moduleIds as string[])
          : Object.keys(modules)
        const facade: string | undefined = (item as any).facadeModuleId
        const origins =
          moduleIds.map((m) => {
            const moduleName = winPath(path.relative(cwd, m))
            const reqBase = facade || m
            // 以模块相对其所在目录形成 request；保持 posix 风格
            let rel = path.relative(path.dirname(reqBase), m)
            if (!rel.startsWith('.')) rel = `./${rel}`
            const request = winPath(rel)
            return { moduleName, request }
          }) || []

        chunks.push({
          // webpack-like fields used by downstream
          names: item.name ? [item.name] : [],
          files: [item.fileName],
          size,
          // fields expected by routePreloadOnLoad
          entry: Boolean((item as any).isEntry),
          id: item.fileName,
          origins,
        } as any)
        assets.push({ name: item.fileName, size })
        compilationAssets[item.fileName] = compilationAssets[item.fileName] || {
          size: () => size,
        }
        if (item.name) {
          assetsByChunkName[item.name] = assetsByChunkName[item.name]
            ? ([] as string[]).concat(
                assetsByChunkName[item.name] as any,
                item.fileName,
              )
            : [item.fileName]
        }
      }
    }
  }

  // 关键：根级字段 + 兼容方法
  const self: any = {
    // 根级字段，给 getAssetsMap 直接读取
    assets,
    chunks,
    assetsByChunkName,
    warnings,
    errors,
    // 提供 webpack 期望的 compilation.assets 结构
    compilation: {
      assets: compilationAssets,
    },
    // 兼容 MultiStats 读取场景：stats.stats ? stats.stats[0] : stats
    // 这里把自身包一层，满足 stats.stats[0]
    stats: undefined as any,
    // 兼容 webpack Stats API
    hasErrors() {
      return errors.length > 0
    },
    hasWarnings() {
      return warnings.length > 0
    },
    toJson() {
      return {
        assets,
        chunks,
        assetsByChunkName,
        warnings,
        errors,
        time: timeMs,
      }
    },
  }
  self.stats = [self]
  return self
}

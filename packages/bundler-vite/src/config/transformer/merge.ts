import type { IConfigProcessor } from '.'

/**
 * Merge from user config
 */
export default (function merge(userConfig) {
  if (typeof userConfig.vite6 === 'object') {
    return userConfig.vite6
  }
} as IConfigProcessor)

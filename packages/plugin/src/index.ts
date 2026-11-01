import type { CollectionConfig, Config, GlobalConfig, LivePreviewConfig } from 'payload'

import { withPluginTranslations } from './translations/index.js'

export { AdminBridge } from './utils/adminBridge.js'
export type { AdminBridgeOptions, AdminMessageHandler } from './utils/adminBridge.js'
export { blockOpErrorKey, normalizeBlockOps, planBlockOp, resolveRowIndexById } from './utils/blockOps.js'
export type { BlockOpPlan, FormRowsLike } from './utils/blockOps.js'
export { resolveDataPath } from './utils/fieldPaths.js'
export type {
  BlockSchemaLike,
  BlocksMapLike,
  FieldSchemaLike,
  ResolvedDataPath,
  ResolveDataPathArgs,
  TabSchemaLike,
} from './utils/fieldPaths.js'
export {
  collectRowExpansions,
  collectRowIsolation,
  fieldElementId,
  findFieldElement,
  focusFormField,
  isValidDataPath,
  pathFromFormElement,
} from './utils/formFocus.js'
export type { FocusFormFieldArgs, RowExpansion, RowLike } from './utils/formFocus.js'
export { buildDocRef, buildPermissionSummary, collectBlockLabels } from './utils/helloPayload.js'
export { placePopover, translateIframePoint } from './utils/popoverPosition.js'
export type { IframeRectLike, PopoverPoint, PopoverSize } from './utils/popoverPosition.js'
export { popoverLabel, resolvePopoverPermissions, resolvePopoverTarget } from './utils/popoverTarget.js'
export type { PopoverTarget, ResolvePopoverPermissionsArgs, ResolvePopoverTargetArgs } from './utils/popoverTarget.js'
export { buildViewPath, parseViewSegments } from './utils/viewPath.js'
export type { ViewTarget } from './utils/viewPath.js'

export type BlockOpsOptions = {
  add?: boolean
  duplicate?: boolean
  move?: boolean
  remove?: boolean
}

export type VisualEditorEntityOptions = {
  blockOps?: BlockOpsOptions | false
  url?: LivePreviewConfig['url']
}

export type VisualEditorToolbarOptions = {
  breakpoint?: boolean
  exit?: boolean
  locale?: boolean
}

export type VisualEditorViewOptions = {
  enabled?: boolean
  /** Must contain the `:collectionSlug` and `:id` params; globals mount at `…/globals/:globalSlug`. */
  path?: string
}

export type VisualEditorOptions = {
  breakpoints?: 'inherit' | LivePreviewConfig['breakpoints']
  collections?: Record<string, true | VisualEditorEntityOptions>
  debug?: boolean
  globals?: Record<string, true | VisualEditorEntityOptions>
  toolbar?: VisualEditorToolbarOptions
  view?: VisualEditorViewOptions
}

export type VisualEditorClientProps = {
  blockOps?: BlockOpsOptions | false
  debug?: boolean
}

/**
 * Options snapshot the plugin stores under `admin.custom` — the only config
 * channel that reaches both the view RSC (sanitized server config) and client
 * components (client config).
 */
export type VisualEditorRuntimeConfig = {
  collections: string[]
  globals: string[]
  toolbar: Required<VisualEditorToolbarOptions>
  view: null | { path: string }
}

export const PLUGIN_CONFIG_KEY = '@digitalvantage/payload-visual-editor'

export const DEFAULT_VIEW_PATH = '/visual-editor/:collectionSlug/:id'

export const visualEditorRuntime = (
  admin: { custom?: Record<string, unknown> } | undefined,
): null | VisualEditorRuntimeConfig =>
  (admin?.custom?.[PLUGIN_CONFIG_KEY] as undefined | VisualEditorRuntimeConfig) ?? null

const CONTROLLER_PATH = '@digitalvantage/payload-visual-editor/client#VisualEditorController'

const VIEW_COMPONENT_PATH = '@digitalvantage/payload-visual-editor/rsc#VisualEditorView'

type EntityKind = 'collections' | 'globals'

type Entity = CollectionConfig | GlobalConfig

const normalizeEntityOptions = (value: true | VisualEditorEntityOptions): VisualEditorEntityOptions =>
  value === true ? {} : value

const hasLivePreviewURL = (entity: Entity, config: Config, kind: EntityKind): boolean => {
  if (entity.admin?.livePreview?.url) {
    return true
  }
  const root = config.admin?.livePreview
  if (!root?.url) {
    return false
  }
  const slugs = kind === 'collections' ? root.collections : root.globals
  return Boolean(slugs?.includes(entity.slug))
}

const resolveEntityOptions = (
  explicit: Record<string, true | VisualEditorEntityOptions> | undefined,
  entity: Entity,
  config: Config,
  kind: EntityKind,
): null | VisualEditorEntityOptions => {
  if (explicit) {
    const value = explicit[entity.slug]
    if (!value) {
      return null
    }
    const entityOptions = normalizeEntityOptions(value)
    if (!entityOptions.url && !hasLivePreviewURL(entity, config, kind)) {
      const scope = kind === 'collections' ? 'Collection' : 'Global'
      throw new Error(
        `[@digitalvantage/payload-visual-editor] ${scope} "${entity.slug}" is enabled for the visual editor but has no Live Preview URL. ` +
          `Set admin.livePreview.url on the ${scope.toLowerCase()} (or list it in config.admin.livePreview), ` +
          `or pass a url in visualEditor({ ${kind}: { ${entity.slug}: { url } } }).`,
      )
    }
    return entityOptions
  }
  return hasLivePreviewURL(entity, config, kind) ? {} : null
}

const withEntityLivePreview = <T extends Entity>(entity: T, url: LivePreviewConfig['url'] | undefined): T =>
  url
    ? {
        ...entity,
        admin: {
          ...entity.admin,
          livePreview: { ...entity.admin?.livePreview, url },
        },
      }
    : entity

const controllerComponent = (entityOptions: VisualEditorEntityOptions, pluginOptions: VisualEditorOptions) => ({
  clientProps: {
    blockOps: entityOptions.blockOps,
    debug: pluginOptions.debug,
  } satisfies VisualEditorClientProps,
  path: CONTROLLER_PATH,
})

/**
 * Enables the inline visual editor for collections/globals that have a Live
 * Preview URL (or are explicitly listed). Injects the controller inside the
 * document <Form> via edit.beforeDocumentControls and, unless disabled,
 * registers the dedicated view at `view.path`.
 */
export const visualEditor =
  (pluginOptions: VisualEditorOptions = {}) =>
  (config: Config): Config => {
    const enabledCollections: string[] = []
    const enabledGlobals: string[] = []

    const collections = (config.collections ?? []).map((collection) => {
      const entityOptions = resolveEntityOptions(pluginOptions.collections, collection, config, 'collections')
      if (!entityOptions) {
        return collection
      }
      enabledCollections.push(collection.slug)
      const withUrl = withEntityLivePreview(collection, entityOptions.url)
      return {
        ...withUrl,
        admin: {
          ...withUrl.admin,
          components: {
            ...withUrl.admin?.components,
            edit: {
              ...withUrl.admin?.components?.edit,
              beforeDocumentControls: [
                ...(withUrl.admin?.components?.edit?.beforeDocumentControls ?? []),
                controllerComponent(entityOptions, pluginOptions),
              ],
            },
          },
        },
      }
    })

    const globals = (config.globals ?? []).map((global) => {
      const entityOptions = resolveEntityOptions(pluginOptions.globals, global, config, 'globals')
      if (!entityOptions) {
        return global
      }
      enabledGlobals.push(global.slug)
      const withUrl = withEntityLivePreview(global, entityOptions.url)
      return {
        ...withUrl,
        admin: {
          ...withUrl.admin,
          components: {
            ...withUrl.admin?.components,
            elements: {
              ...withUrl.admin?.components?.elements,
              beforeDocumentControls: [
                ...(withUrl.admin?.components?.elements?.beforeDocumentControls ?? []),
                controllerComponent(entityOptions, pluginOptions),
              ],
            },
          },
        },
      }
    })

    const viewEnabled = pluginOptions.view?.enabled !== false
    const viewPath = pluginOptions.view?.path ?? DEFAULT_VIEW_PATH
    if (viewEnabled && (!viewPath.includes(':collectionSlug') || !viewPath.includes(':id'))) {
      throw new Error(
        `[@digitalvantage/payload-visual-editor] view.path "${viewPath}" must contain the :collectionSlug and :id params ` +
          `(default: "${DEFAULT_VIEW_PATH}").`,
      )
    }

    const runtime: VisualEditorRuntimeConfig = {
      collections: enabledCollections,
      globals: enabledGlobals,
      toolbar: {
        breakpoint: pluginOptions.toolbar?.breakpoint !== false,
        exit: pluginOptions.toolbar?.exit !== false,
        locale: pluginOptions.toolbar?.locale !== false,
      },
      view: viewEnabled ? { path: viewPath } : null,
    }

    return {
      ...config,
      admin: {
        ...config.admin,
        components: {
          ...config.admin?.components,
          views: viewEnabled
            ? {
                ...config.admin?.components?.views,
                'visual-editor': {
                  Component: VIEW_COMPONENT_PATH,
                  exact: true,
                  path: viewPath as `/${string}`,
                },
              }
            : config.admin?.components?.views,
        },
        custom: { ...config.admin?.custom, [PLUGIN_CONFIG_KEY]: runtime },
      },
      collections,
      globals,
      i18n: withPluginTranslations(config.i18n),
    }
  }

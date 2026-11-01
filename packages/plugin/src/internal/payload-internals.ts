/**
 * Single choke point for every @payloadcms/ui (and other Payload-internal)
 * import in this package. When a Payload upgrade breaks an internal API, it
 * surfaces here and nowhere else.
 */
export {
  ActionsProvider,
  BlocksDrawer,
  BulkUploadProvider,
  Button,
  ConfirmationModal,
  Drawer,
  EntityVisibilityProvider,
  FieldPathContext,
  LoadingOverlay,
  RenderFields,
  ShimmerEffect,
  toast,
  useConfig,
  useDocumentDrawer,
  useDocumentDrawerContext,
  useDocumentInfo,
  useForm,
  useFormFields,
  useLivePreviewContext,
  useLocale,
  useModal,
  useServerFunctions,
  XIcon,
} from '@payloadcms/ui'
// NOTE: deep imports like '@payloadcms/ui/elements/*' bundle a second copy of
// the UI contexts (their hooks then see no provider) — only barrel exports work
export type { RenderDocumentResult } from '@payloadcms/ui'

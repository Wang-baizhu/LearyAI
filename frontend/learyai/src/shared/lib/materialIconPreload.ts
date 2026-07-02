// materialIconPreload defines and preloads common Material icons.
import { preloadMaterialIcons } from '@/shared/ui/icons/materialIconLoader';

const COMMON_MATERIAL_ICONS = [
  'add',
  'arrow_back',
  'arrow_forward',
  'auto_awesome',
  'calendar_today',
  'check',
  'chevron_left',
  'chevron_right',
  'close',
  'delete',
  'edit',
  'logout',
  'more_horiz',
  'search',
  'smart_toy',
] as const;

const preloadCommonMaterialIcons = () => preloadMaterialIcons([...COMMON_MATERIAL_ICONS]);

export { COMMON_MATERIAL_ICONS, preloadCommonMaterialIcons };

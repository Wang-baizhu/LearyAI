const ICON_SOURCES = new Map<string, string>();
const ICON_PENDING = new Map<string, Promise<string>>();
const ICON_BASE_URL =
  'https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined';

export const getCachedMaterialIconSvg = (iconName: string) =>
  ICON_SOURCES.get(iconName) ?? '';

export const fetchMaterialIconSvg = async (iconName: string) => {
  if (ICON_SOURCES.has(iconName)) {
    return ICON_SOURCES.get(iconName) ?? '';
  }
  if (ICON_PENDING.has(iconName)) {
    return ICON_PENDING.get(iconName) ?? '';
  }
  const request = fetch(`${ICON_BASE_URL}/${iconName}/default/24px.svg`)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`icon fetch failed: ${iconName}`);
      }
      return response.text();
    })
    .then((svgText) => {
      ICON_SOURCES.set(iconName, svgText);
      ICON_PENDING.delete(iconName);
      return svgText;
    })
    .catch(() => {
      ICON_PENDING.delete(iconName);
      return '';
    });
  ICON_PENDING.set(iconName, request);
  return request;
};

export const preloadMaterialIcon = (iconName: string) => {
  if (!iconName) {
    return Promise.resolve('');
  }
  return fetchMaterialIconSvg(iconName);
};

export const preloadMaterialIcons = (iconNames: string[]) => {
  const uniqueNames = Array.from(new Set(iconNames.filter(Boolean)));
  return Promise.all(uniqueNames.map((name) => fetchMaterialIconSvg(name))).then(() => undefined);
};

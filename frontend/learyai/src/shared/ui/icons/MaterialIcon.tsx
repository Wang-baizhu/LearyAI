// MaterialIcon 负责按名称加载 Material Symbols SVG，并应用当前文本样式。
import React, { useEffect, useState } from 'react';
import { fetchMaterialIconSvg, getCachedMaterialIconSvg } from './materialIconLoader';

const prepareSvg = (svg: string) =>
  svg
    .replace('<svg ', '<svg width="1em" height="1em" fill="currentColor" role="img" aria-hidden="true" focusable="false" ')
    .replace(/fill="(?!none)[^"]*"/g, 'fill="currentColor"');

interface MaterialIconProps {
  name: string;
  className?: string;
  title?: string;
}

const MaterialIcon: React.FC<MaterialIconProps> = ({ name, className = '', title }) => {
  const [svgSource, setSvgSource] = useState(() => getCachedMaterialIconSvg(name));
  const cachedSvg = getCachedMaterialIconSvg(name);
  const renderedSvg = cachedSvg || svgSource;

  useEffect(() => {
    let active = true;
    if (!name) {
      return undefined;
    }
    if (cachedSvg) {
      return undefined;
    }
    fetchMaterialIconSvg(name).then((svgText) => {
      if (active) {
        setSvgSource(svgText);
      }
    });
    return () => {
      active = false;
    };
  }, [cachedSvg, name]);

  if (!renderedSvg) {
    return (
      <span
        className={`inline-flex items-center justify-center leading-none ${className}`.trim()}
        aria-hidden={title ? undefined : true}
        aria-label={title}
        title={title}
        style={{ width: '1em', height: '1em' }}
      >
        {' '}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center leading-none ${className}`.trim()}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      title={title}
      dangerouslySetInnerHTML={{ __html: prepareSvg(renderedSvg) }}
    />
  );
};

export default MaterialIcon;

/** 责任：维护白板边重连点击区域的样式覆盖。 */
export const reconnectHandleStyle = `
.react-flow__edge-reconnecthandle {
  width: 50% !important;
  height: 100% !important;
  stroke-opacity: 0 !important;
  cursor: crosshair;
}
.react-flow__edge.reconnectable {
  cursor: pointer;
}
`;

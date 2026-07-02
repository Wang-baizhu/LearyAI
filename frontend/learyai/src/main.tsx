// main 负责启动运行时初始化并挂载 React 应用。
import { initRuntime } from '@/app/bootstrap/initRuntime';
import { renderApp } from '@/app/bootstrap/renderApp';
import './index.css';
import '@/shared/ui/safe-area.css';

await initRuntime();
renderApp();

// HyperSpeedLoader 负责渲染页面级高速加载动画，供全局加载场景复用。
import React from 'react';
import './hyperSpeedLoader.css';

interface HyperSpeedLoaderProps {
  className?: string;
}

const HyperSpeedLoader: React.FC<HyperSpeedLoaderProps> = ({ className = '' }) => {
  return (
    <div className={`ai-hyper-root ${className}`.trim()} aria-label="连接中" role="status">
      <div className="ai-hyper-fazers" aria-hidden>
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="ai-hyper-loader" aria-hidden>
        <span className="ai-hyper-jet">
          <span />
          <span />
          <span />
          <span />
        </span>
        <div className="ai-hyper-base">
          <span />
          <div className="ai-hyper-face" />
        </div>
      </div>
      <div className="ai-hyper-caption">正在加载中...</div>
    </div>
  );
};

export default HyperSpeedLoader;

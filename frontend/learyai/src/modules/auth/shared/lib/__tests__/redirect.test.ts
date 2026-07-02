// redirect.test.ts 负责验证登录跳转路径的构造与安全回退规则。
import { describe, expect, it } from 'vitest';
import {
  buildLoginRedirectPath,
  DEFAULT_POST_AUTH_REDIRECT,
  resolveAuthRedirectTarget,
} from '../redirect';

describe('auth redirect helpers', () => {
  it('构造带 redirect query 的登录地址', () => {
    expect(
      buildLoginRedirectPath({
        pathname: '/project/123',
        search: '?tab=plugin',
        hash: '#detail',
      }),
    ).toBe('/?redirect=%2Fproject%2F123%3Ftab%3Dplugin%23detail');
  });

  it('接受站内相对路径作为跳转目标', () => {
    expect(resolveAuthRedirectTarget('/resource-center/1/2')).toBe('/resource-center/1/2');
  });

  it('对空值和登录首页回退到默认工作台', () => {
    expect(resolveAuthRedirectTarget(null)).toBe(DEFAULT_POST_AUTH_REDIRECT);
    expect(resolveAuthRedirectTarget('/')).toBe(DEFAULT_POST_AUTH_REDIRECT);
  });

  it('拒绝外站或协议相对路径', () => {
    expect(resolveAuthRedirectTarget('https://example.com/evil')).toBe(DEFAULT_POST_AUTH_REDIRECT);
    expect(resolveAuthRedirectTarget('//example.com/evil')).toBe(DEFAULT_POST_AUTH_REDIRECT);
  });
});

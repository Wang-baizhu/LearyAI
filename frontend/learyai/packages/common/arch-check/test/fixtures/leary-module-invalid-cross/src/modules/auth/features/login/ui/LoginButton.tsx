// 该文件负责构造跨 module 深层导入的非法样例，供 arch-check 测试使用。
// eslint-disable-next-line no-restricted-syntax -- fixture 需保留跨 module 深层相对路径，用于验证 arch-check 会报错
import { ProfileCard } from '../../../../../modules/profile/features/account/ui/ProfileCard'

export function LoginButton() {
  return ProfileCard
}

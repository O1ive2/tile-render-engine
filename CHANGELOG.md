# ChangeLog

## 0.1.3

### Bug Fixes

- **线宽问题:** 修复了首屏下的线段消失或者变淡的问题，此修复仅针对 scale >= 1 的场景
- **Rect 边框被切割:** 修复 Rect 边框跨 Block 不显示问题（表现为被切割）

### Feature

- **缩放接口:** 新增缩放接口，实现 schematic 内容放大缩小功能
- **重置接口:** 新增重置接口，实现 schematic 内容恢复初始状态的功能
- **Rect 图形属性:** 新增`keepWidth`属性，当设置为 1 时，Rect 的边框不会跟随缩放

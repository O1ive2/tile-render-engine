# ChangeLog

## 0.1.3

### Bug Fixes

* **线宽问题:** 修复了首屏下的线段消失或者变淡的问题，此修复仅针对 scale >= 1 的场景
* **Rect边框被切割:** 修复Rect边框跨Block不显示问题（表现为被切割）

### Feature

* **Rect图形属性:** 新增```keepWidth```属性，当设置为1时，Rect的边框不会跟随缩放

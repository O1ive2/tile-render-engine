# ChangeLog

## 0.2.1

### Bug Fixes

* **远程桌面下的卡顿：** 修复了render循环导致的渲染卡顿

### Features

* **缩放自适应：** 现在缩放canvas，内容会跟随视窗自适应渲染了

## 0.2.0

### Bug Fixes

* **多实例变慢:** 修复了多个Gaia实例变慢的问题

### Features

* **paint.clear：** 新增```paint.clear```方法，用于清空画布
* **paint.flush：** ```paint.flush```新增boolean型入参，默认为true：重置当前画布的transform信息，false：保留当前画布transform信息，但不会触发render绘制

### Break Changes

* **Gaia和Paint作用域：** 旧版的Gaia和Paint作用域一致。新版Gaia被设计为渲染业务的入口，不同的Gaia实例对应不同的业务，如Schematic和LayoutView两个业务就需要两个Gaia实例，一个Gaia实例包含一组Webworker。新版Paint依附于某个Gaia实例，由```gaia.createPaint```生成，一个Gaia实例可生成多个Paint实例，一个Paint对应一个canvas，具体用法参考Readme

* **Paint.setProperty：** ```Paint.setProperty``` 取代 ```Paint.highlight```，以更符合API语义

## 0.1.3

### Bug Fixes

- **线宽问题:** 修复了首屏下的线段消失或者变淡的问题，此修复仅针对 scale >= 1 的场景
- **Rect 边框被切割:** 修复 Rect 边框跨 Block 不显示问题（表现为被切割）

### Features

- **缩放接口:** 新增缩放接口，实现 schematic 内容放大缩小功能
- **重置接口:** 新增重置接口，实现 schematic 内容恢复初始状态的功能
- **Rect 图形属性:** 新增`keepWidth`属性，当设置为 1 时，Rect 的边框不会跟随缩放

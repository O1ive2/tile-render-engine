# ChangeLog

### Features

- **新增 svg 绘制接口：** 新增`paint.drawSvg`方法，用于绘制 svg 图形

## 0.2.3

### Bug Fixes

- **resize 导致的首屏两次渲染：** canvas 的父容器在初始化时宽高会有个从 0 跳变到固定值的过程，这会触发两次首屏渲染，现已修复

## 0.2.2

### Features

- **paint.onBlank：** 新增`onBlank`方法，支持`click`、`rclick`和`dbclick`回调，用于触发非图形区域的回调

## 0.2.1

### Bug Fixes

- **远程桌面下的卡顿：** 修复了 render 循环导致的渲染卡顿

### Features

- **缩放自适应：** 现在缩放 canvas，内容会跟随视窗自适应渲染了

## 0.2.0

### Bug Fixes

- **多实例变慢:** 修复了多个 Gaia 实例变慢的问题

### Features

- **paint.clear：** 新增`paint.clear`方法，用于清空画布
- **paint.flush：** `paint.flush`新增 boolean 型入参，默认为 true：重置当前画布的 transform 信息，false：保留当前画布 transform 信息，但不会触发 render 绘制

### Break Changes

- **Gaia 和 Paint 作用域：** 旧版的 Gaia 和 Paint 作用域一致。新版 Gaia 被设计为渲染业务的入口，不同的 Gaia 实例对应不同的业务，如 Schematic 和 LayoutView 两个业务就需要两个 Gaia 实例，一个 Gaia 实例包含一组 Webworker。新版 Paint 依附于某个 Gaia 实例，由`gaia.createPaint`生成，一个 Gaia 实例可生成多个 Paint 实例，一个 Paint 对应一个 canvas，具体用法参考 Readme

- **Paint.setProperty：** `Paint.setProperty` 取代 `Paint.highlight`，以更符合 API 语义

## 0.1.3

### Bug Fixes

- **线宽问题:** 修复了首屏下的线段消失或者变淡的问题，此修复仅针对 scale >= 1 的场景
- **Rect 边框被切割:** 修复 Rect 边框跨 Block 不显示问题（表现为被切割）

### Features

- **缩放接口:** 新增缩放接口，实现 schematic 内容放大缩小功能
- **重置接口:** 新增重置接口，实现 schematic 内容恢复初始状态的功能
- **Rect 图形属性:** 新增`keepWidth`属性，当设置为 1 时，Rect 的边框不会跟随缩放

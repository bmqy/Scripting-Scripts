// 为Scripting App提供JSX运行时支持
import type { VirtualNode, FunctionComponent, ComponentProps } from 'scripting';

export function createElement(type: FunctionComponent<any> | string, props?: ComponentProps<any>, ...children: any[]): VirtualNode {
  if (props && children.length > 0) {
    // 如果有子元素，添加到props中
    props = { ...props, children };
  }
  return {
    isInternal: false,
    props: props || {},
    render: typeof type === 'function' ? type : (() => ({ type, props }))
  } as unknown as VirtualNode;
}

export function Fragment(props: { children?: any }): VirtualNode {
  return {
    isInternal: false,
    props: props || {},
    render: (() => props.children)
  } as unknown as VirtualNode;
}

// 导出JSX工厂函数
export default {
  createElement,
  Fragment
};
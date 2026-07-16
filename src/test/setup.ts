import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// The mock backend persists to localStorage; clear it between tests so each
// test starts from a clean, empty universe.
afterEach(() => {
  window.localStorage.clear();
});

// jsdom reports all elements as 0x0, so @tanstack/react-virtual (which
// measures the scroll container to decide how many rows to render) thinks
// there's no visible space and renders nothing. Give every element a
// reasonable non-zero size -- matching a realistic desktop viewport, since
// this app is desktop-first -- so virtualized/windowed views (character
// list, timeline) behave in tests the way they do in a real browser window.
Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
  configurable: true,
  value: 800,
});
Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
  configurable: true,
  value: 1280,
});
// jsdom never computes layout, so clientWidth/clientHeight (used by
// TimelineView to size its render window) stay 0 unless explicitly set.
Object.defineProperty(HTMLElement.prototype, "clientHeight", {
  configurable: true,
  value: 800,
});
Object.defineProperty(HTMLElement.prototype, "clientWidth", {
  configurable: true,
  value: 1280,
});
if (!Element.prototype.getBoundingClientRect || true) {
  Element.prototype.getBoundingClientRect = function (
    this: Element,
  ): DOMRect {
    return {
      width: 1280,
      height: 800,
      top: 0,
      left: 0,
      right: 1280,
      bottom: 800,
      x: 0,
      y: 0,
      toJSON() {
        return this;
      },
    } as DOMRect;
  };
}

// jsdom has no ResizeObserver; @tanstack/react-virtual uses it to remeasure
// the scroll container. Without it, the virtualizer never learns the
// container has a non-zero size and renders zero rows.
if (!("ResizeObserver" in window)) {
  class MockResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // @ts-expect-error -- test-only polyfill
  window.ResizeObserver = MockResizeObserver;
}

// jsdom has no <canvas> 2D rendering backend at all; react-force-graph's
// underlying force-graph library calls canvas.getContext("2d") during init
// and expects a real context back. We only need it to not throw in tests --
// we're not asserting on pixel output, just that the component mounts and
// wires up its data correctly.
const noopContext = {
  scale: () => {},
  clearRect: () => {},
  fillRect: () => {},
  beginPath: () => {},
  arc: () => {},
  fill: () => {},
  stroke: () => {},
  moveTo: () => {},
  lineTo: () => {},
  save: () => {},
  restore: () => {},
  translate: () => {},
  measureText: () => ({ width: 0 }),
  fillText: () => {},
  setTransform: () => {},
  getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
};
HTMLCanvasElement.prototype.getContext = (() =>
  noopContext) as unknown as typeof HTMLCanvasElement.prototype.getContext;

// jsdom doesn't implement matchMedia; react-force-graph / some libs probe it.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

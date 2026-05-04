export function deprecate(msg, fn) {
  if (typeof fn !== 'function') return fn;
  return function() {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(`Deprecation warning: ${  msg}`);
    }
    return fn.apply(this, arguments);
  };
}

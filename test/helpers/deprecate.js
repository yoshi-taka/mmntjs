export function deprecate(msg, fn) {
  if (typeof fn !== 'function') {return fn;}
  return function() {
    console.warn(`Deprecation warning: ${  msg}`);
    return fn.apply(this, arguments);
  };
}

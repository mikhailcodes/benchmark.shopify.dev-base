const _bootstrap = window.__NS__Settings;

window.__NS__ = {
  settings: {
    devMode: _bootstrap?.devMode ?? import.meta.env.DEV,
    debugEvents: false,
  },
  theme: {
    shopName: window.Shopify?.shop || '__NS__',
    currency: window.Shopify?.currency?.active || 'USD',
    moneyFormat: window.theme?.moneyFormat || '${{amount}}',
  },
  routes: _bootstrap?.routes ?? {
    cart: '/cart',
    cartAdd: '/cart/add',
    cartChange: '/cart/change',
    cartUpdate: '/cart/update',
    predictiveSearch: '/search/suggest',
  },
  cart: {
    count: _bootstrap?.cart.count ?? 0,
    total: _bootstrap?.cart.total ?? 0,
  },
  events: new EventTarget(),
  version: '1.0.0',
};

export default window.__NS__;

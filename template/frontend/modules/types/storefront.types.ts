declare global {
  interface Window {
    __NS__: StorefrontGlobal;
    __NS__Settings?: LiquidBootstrap;
    Shopify?: {
      shop?: string;
      currency?: { active: string };
      designMode?: boolean;
    };
    theme?: {
      moneyFormat?: string;
    };
  }
}

export type LiquidBootstrap = {
  devMode: boolean;
  routes: Record<'cart' | 'cartAdd' | 'cartChange' | 'cartUpdate' | 'predictiveSearch', string>;
  cart: { count: number; total: number };
};

export type StorefrontGlobal = {
  settings: {
    devMode: boolean;
    debugEvents: boolean;
  };
  theme: {
    shopName: string;
    currency: string;
    moneyFormat: string;
  };
  routes: LiquidBootstrap['routes'];
  cart: {
    count: number;
    total: number;
  };
  events: EventTarget;
  version: string;
};

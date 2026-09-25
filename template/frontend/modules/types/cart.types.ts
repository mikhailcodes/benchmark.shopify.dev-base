export type CartDiscountCode = {
  code: string;
  amount: number;
  type: string;
};

export type CartPayload = {
  token: string;
  item_count: number;
  total_price: number;
  items_subtotal_price: number;
  note: string | null;
  discount_codes?: readonly CartDiscountCode[];
};

export type LiquidAjaxCartRequestType = 'add' | 'change' | 'update' | 'clear' | 'get';

export type LiquidAjaxCartRequestState = {
  requestType: LiquidAjaxCartRequestType;
  endpoint: string;
  requestBody?: FormData | URLSearchParams | Record<string, unknown>;
  responseData: { ok: boolean; status: number; body: Record<string, unknown> } | null;
};

export type LiquidAjaxCartRequestEndEvent = CustomEvent<{
  requestState: LiquidAjaxCartRequestState;
  cart?: CartPayload;
  previousCart?: CartPayload;
}>;

declare global {
  interface Window {
    liquidAjaxCart?: {
      readonly cart: CartPayload;
      readonly processing: boolean;
      update: (body?: Record<string, unknown>, options?: Record<string, unknown>) => void;
    };
  }
}

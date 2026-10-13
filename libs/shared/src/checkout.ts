import { z } from 'zod';
import { OrderStatus, PaymentMethod } from './order.js';
import { Paise } from './money.js';

export const STATES = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
] as const;

export const Address = z.object({
  name: z.string().trim().min(2, 'Enter the name on the parcel').max(80),
  line1: z.string().trim().min(3, 'Enter the street address').max(120),
  line2: z.string().trim().max(120).optional(),
  city: z.string().trim().min(2, 'Enter the city').max(60),
  state: z.enum(STATES, { error: 'Choose a state' }),
  /** Indian PIN: six digits, never starting with 0. */
  pincode: z.string().regex(/^[1-9]\d{5}$/, 'A PIN code is six digits'),
});
export type Address = z.infer<typeof Address>;

/** Ten digits starting 6–9, optionally prefixed +91 or 0. Normalised to +91XXXXXXXXXX. */
export const IndianMobile = z
  .string()
  .transform((s) => s.replace(/[\s-]/g, ''))
  .pipe(
    z
      .string()
      .regex(/^(?:\+91|0)?[6-9]\d{9}$/, 'Enter a 10-digit mobile number'),
  )
  .transform((s) => `+91${s.slice(-10)}`);

export const PlaceOrder = z.object({
  cartId: z.uuid(),
  email: z.email('Enter an email for your receipt'),
  phone: IndianMobile,
  address: Address,
  /** PREPAID covers UPI, cards and the rest — the method is known once Razorpay reports it. */
  pay: z.enum(['PREPAID', 'COD']),
});
export type PlaceOrder = z.infer<typeof PlaceOrder>;

/** docs/11: shipping free over ₹999, ₹80 below; COD carries an ₹80 handling fee. */
export const FREE_SHIPPING_FROM = 99_900;
export const SHIPPING = 8_000;
export const COD_FEE = 8_000;
/** Apparel at or under ₹1,000 is 5% GST; prices are GST-inclusive. */
export const GST_RATE = 0.05;

export interface Totals {
  subtotalPaise: number;
  shippingPaise: number;
  /** The GST already inside the prices — shown, not added. */
  taxPaise: number;
  totalPaise: number;
}

export function priceOrder(
  subtotalPaise: number,
  pay: 'PREPAID' | 'COD',
): Totals {
  const shippingPaise =
    (subtotalPaise >= FREE_SHIPPING_FROM ? 0 : SHIPPING) +
    (pay === 'COD' ? COD_FEE : 0);
  return {
    subtotalPaise,
    shippingPaise,
    taxPaise: Math.round((subtotalPaise * GST_RATE) / (1 + GST_RATE)),
    totalPaise: subtotalPaise + shippingPaise,
  };
}

/** What the browser needs to open the payment sheet. No secret is ever in here. */
export const PaymentHandoff = z.object({
  provider: z.enum(['razorpay', 'fake']),
  providerOrderId: z.string(),
  /** Razorpay's public key id (rzp_test_… / rzp_live_…). Public by design. */
  keyId: z.string().nullable(),
  amountPaise: Paise,
});
export type PaymentHandoff = z.infer<typeof PaymentHandoff>;

export const OrderLine = z.object({
  title: z.string(),
  sku: z.string(),
  size: z.string(),
  colour: z.string(),
  pricePaise: Paise,
  quantity: z.number().int(),
});

export const OrderView = z.object({
  reference: z.string(),
  status: OrderStatus,
  method: PaymentMethod.nullable(),
  email: z.string(),
  lines: z.array(OrderLine),
  subtotalPaise: Paise,
  shippingPaise: Paise,
  taxPaise: Paise,
  totalPaise: Paise,
  trackingUrl: z.string().nullable(),
  createdAt: z.string(),
});
export type OrderView = z.infer<typeof OrderView>;

export const PlacedOrder = z.object({
  reference: z.string(),
  /** Signed, single-order view token for /order/[reference]?t= (docs/05 §6). */
  token: z.string(),
  status: OrderStatus,
  payment: PaymentHandoff.nullable(),
});
export type PlacedOrder = z.infer<typeof PlacedOrder>;

export const VerifyPayment = z.object({
  providerOrderId: z.string().min(1),
  paymentId: z.string().min(1),
  signature: z.string().min(1),
});
export type VerifyPayment = z.infer<typeof VerifyPayment>;

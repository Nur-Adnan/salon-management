import { type Money, add, mulInt, subtract, zero } from './money.js';

export interface PricedComponent {
  price: Money;
  quantity: number;
}

/** Σ(price × quantity) over a package's components. Empty list => zero BDT. */
export function componentsTotal(components: PricedComponent[]): Money {
  return components.reduce((acc, c) => add(acc, mulInt(c.price, c.quantity)), zero());
}

/** componentsTotal − packagePrice. Positive = customer savings; negative = premium bundle. */
export function packageSavings(total: Money, packagePrice: Money): Money {
  return subtract(total, packagePrice);
}

export const MAX_ORDER_ITEM_QUANTITY = 999;

// Recipes already use the inventory API's canonical units and usable stock.
export function cartFitsInventory(
  lines: { id: number; quantity: number; includedSelections?: { product_id: number; qty: number }[] }[],
  products: { id: number; ingredients: { product_id: number; quantity_required: number; stock: number }[] }[],
): boolean {
  const demand = new Map<number, { quantity: number; stock: number }>();
  for (const line of lines) {
    for (const selection of [{ product_id: line.id, qty: 1 }, ...(line.includedSelections || [])]) {
      const product = products.find((entry) => entry.id === selection.product_id);
      if (!product) return false;
      for (const ingredient of product.ingredients) {
        const previous = demand.get(ingredient.product_id);
        demand.set(ingredient.product_id, {
          quantity: (previous?.quantity || 0) + line.quantity * selection.qty * ingredient.quantity_required,
          stock: Math.min(previous?.stock ?? ingredient.stock, ingredient.stock),
        });
      }
    }
  }
  return [...demand.values()].every((entry) => Number.isFinite(entry.quantity) && entry.quantity <= entry.stock + 0.0000001);
}

export function getEffectiveMaxQuantity(availableStock: unknown): number {
  const stock = Number(availableStock);
  if (!Number.isFinite(stock) || stock <= 0) return 0;
  return Math.min(MAX_ORDER_ITEM_QUANTITY, Math.floor(stock));
}

export function clampOrderItemQuantity(
  requestedQuantity: unknown,
  availableStock: unknown,
): number {
  const effectiveMaximum = getEffectiveMaxQuantity(availableStock);
  if (effectiveMaximum === 0) return 0;
  const quantity = Number(requestedQuantity);
  if (!Number.isFinite(quantity)) return 1;
  return Math.min(effectiveMaximum, Math.max(1, Math.floor(quantity)));
}

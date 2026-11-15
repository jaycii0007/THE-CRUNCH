import { useState } from 'react';

export type IncludedChoice = { kind: 'drinks' | 'sauces'; product_id: number; qty: number; name: string };
export type IncludedConfig = Partial<Record<'drinks' | 'sauces', { enabled: boolean; productIds?: number[]; includedQuantity: number }>>;
export type IncludedOption = { id: number; name: string; stock: number; available: boolean; kind?: 'drinks' | 'sauces' | null };
export const hasIncludedChoices = (config?: IncludedConfig) => (['drinks', 'sauces'] as const).some((key) => config?.[key]?.enabled && Number(config[key]?.includedQuantity) > 0);
export const includedKey = (choices: IncludedChoice[] = []) => JSON.stringify(choices.map(({ kind, product_id, qty }) => ({ kind, product_id, qty })).sort((a, b) => a.kind.localeCompare(b.kind) || a.product_id - b.product_id));

export function IncludedChoices({ choices = [], flavorId }: { choices?: { kind: string; name: string; qty: number; product_id?: number }[]; flavorId?: number }) {
  return <>{choices.filter((choice) => !(choice.kind === 'sauces' && flavorId && choice.product_id === flavorId)).map((choice, index) => <span key={index} className={`mt-1 block whitespace-normal text-xs ${choice.kind === 'drinks' ? 'text-blue-700 dark:text-blue-300' : choice.kind === 'sauces' ? 'text-orange-700 dark:text-orange-300' : choice.kind === 'rice' ? 'text-green-700 dark:text-green-300' : 'text-purple-700 dark:text-purple-300'}`}>Included {choice.kind === 'drinks' ? 'Drink' : choice.kind === 'sauces' ? 'Sauce' : choice.kind === 'rice' ? 'Rice' : 'Selection'}: {choice.name} × {choice.qty} (included)</span>)}</>;
}

export function IncludedSelectionModal({ name, config, options, flavors = [], requireFlavor = false, onConfirm, onCancel }: {
  name: string; config?: IncludedConfig; options: IncludedOption[]; flavors?: { id: number; name: string }[];
  requireFlavor?: boolean; onConfirm: (choices: IncludedChoice[], flavorId?: number) => void; onCancel: () => void;
}) {
  const [selections, setSelections] = useState<Partial<Record<'drinks' | 'sauces', number[]>>>({});
  const [flavor, setFlavor] = useState<number>();
  const choices: IncludedChoice[] = [];
  const requiredFlavor = requireFlavor ? options.find((option) => option.id === flavor && option.kind === 'sauces' && option.available) : undefined;
  for (const kind of ['drinks', 'sauces'] as const) {
    const count = config?.[kind]?.enabled ? Number(config[kind]?.includedQuantity) : 0;
    for (let index = 0; index < count; index++) {
      const id = selections[kind]?.[index] ?? (kind === 'sauces' ? requiredFlavor?.id : undefined);
      const option = options.find((entry) => entry.id === id && entry.kind === kind);
      if (!option) continue;
      const existing = choices.find((entry) => entry.kind === kind && entry.product_id === id);
      if (existing) existing.qty++;
      else choices.push({ kind, product_id: option.id, name: option.name, qty: 1 });
    }
  }
  const valid = (!requireFlavor || flavors.some((entry) => entry.id === flavor)) &&
    (['drinks', 'sauces'] as const).every((kind) => {
      const required = config?.[kind]?.enabled ? Number(config[kind]?.includedQuantity) : 0;
      return choices.filter((choice) => choice.kind === kind).reduce((sum, choice) => sum + choice.qty, 0) === required;
    }) && choices.every((choice) => {
      const option = options.find((entry) => entry.id === choice.product_id);
      const total = choices.filter((entry) => entry.product_id === choice.product_id).reduce((sum, entry) => sum + entry.qty, 0);
      return option?.available && option.kind === choice.kind && option.stock >= total;
    });
  return <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-3" role="dialog" aria-modal="true" aria-label={`Selections for ${name}`}>
    <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
      <div className="shrink-0 border-b px-5 py-3"><h2 className="text-lg font-semibold">Choose included selections</h2><p className="text-sm text-neutral-600">{name} ? no additional charge.</p></div>
      <div className="min-h-0 overflow-y-auto px-5 py-3">
        {requireFlavor && <label className="mb-3 block text-sm">Required Chicken Flavor
          <select aria-label="Required Chicken Flavor" className="mt-1 w-full rounded border p-2" value={flavor ?? ''} onChange={(event) => setFlavor(Number(event.target.value) || undefined)}>
            <option value="">Choose one flavor</option>{flavors.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
          </select>
        </label>}
        {(['drinks', 'sauces'] as const).map((kind) => {
          const rule = config?.[kind];
          if (!rule?.enabled || !(rule.includedQuantity > 0)) return null;
          const eligible = options.filter((option) => option.kind === kind && option.available && option.stock > 0);
          // The required flavor also satisfies selection-only sauce servings.
          // Keep real sauce products selectable without listing all flavors twice.
          const visible = eligible.filter((option) => !(kind === 'sauces' && requireFlavor && flavors.some((entry) => entry.id === option.id)));
          if (kind === 'sauces' && requireFlavor && !visible.length && eligible.some((option) => flavors.some((entry) => entry.id === option.id))) return null;
          return <fieldset key={kind} className="mb-3"><legend className="mb-1 text-sm font-medium">Included {kind}{rule.includedQuantity > 1 ? ` ? choose ${rule.includedQuantity}` : ''}</legend>
            {!eligible.length && <p className="text-sm text-red-700">No available choices. This meal cannot be added right now.</p>}
            <div className={rule.includedQuantity > 1 ? 'grid grid-cols-1 gap-2 sm:grid-cols-2' : ''}>
              {Array.from({ length: rule.includedQuantity }, (_, index) => {
                const selected = selections[kind]?.[index] ?? (kind === 'sauces' ? requiredFlavor?.id : undefined);
                return <label key={index} className="block text-sm">
                  {rule.includedQuantity > 1 && <span className="text-xs text-neutral-500">{kind === 'drinks' ? 'Drink' : 'Sauce'} {index + 1}</span>}
                  <select aria-label={`Included ${kind} ${index + 1}`} className="w-full rounded border p-2" value={selected ?? ''}
                    onChange={(event) => {
                      const id = Number(event.target.value) || 0;
                      setSelections((previous) => {
                        const next = [...(previous[kind] || [])]; next[index] = id;
                        return { ...previous, [kind]: next };
                      });
                    }}>
                    <option value="">Choose {kind === 'drinks' ? 'a drink' : 'a sauce'}</option>
                    {kind === 'sauces' && requiredFlavor && <option value={requiredFlavor.id}>Use required Chicken Flavor</option>}
                    {visible.map((option) => {
                      const used = choices.filter((choice) => choice.product_id === option.id).reduce((sum, choice) => sum + choice.qty, 0);
                      return <option key={option.id} value={option.id} disabled={used - (selected === option.id ? 1 : 0) >= option.stock}>{option.name}</option>;
                    })}
                  </select>
                </label>;
              })}
            </div>
          </fieldset>;
        })}
      </div>
      <div className="flex shrink-0 justify-end gap-3 border-t bg-white px-5 py-3"><button type="button" onClick={onCancel} className="rounded border px-4 py-2">Cancel</button>
        <button type="button" disabled={!valid} onClick={() => onConfirm(choices, flavor)} className="rounded bg-green-900 px-4 py-2 text-white disabled:opacity-40">Add to cart</button></div>
    </div>
  </div>;
}

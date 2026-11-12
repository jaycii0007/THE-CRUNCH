import type { Dispatch, SetStateAction } from "react";
import { motion } from "framer-motion";
import { FormField } from "../FormField";
import { StyledInput } from "../StyledInput";
import { StyledSelect } from "../StyledSelect";
import type {
  RawMaterialForm,
  RawMaterialModalMode,
  Supplier,
} from "../../types/inventory";
import {
  sanitizeMaterialNameInput,
  sanitizeShortTextInput,
} from "../../utils/inputUtils";

type AddMaterialModalProps = {
  rawMaterialForm: RawMaterialForm;
  setRawMaterialForm: Dispatch<SetStateAction<RawMaterialForm>>;
  activeInventoryCategoryOptions: string[];
  activeInventoryUnitOptions: { value: string; label: string }[];
  materialNameMaxLength: number;
  materialDescriptionMaxLength: number;
  defaultLowStockThreshold: number;
  defaultCriticalStockThreshold: number;
  submitting: boolean;
  mode?: RawMaterialModalMode;
  suppliers: Supplier[];
  supplierIds: number[];
  onSupplierIdsChange: (ids: number[]) => void;
  onClose: () => void;
  onSave: () => void | Promise<void>;
};

export function AddMaterialModal({
  rawMaterialForm,
  setRawMaterialForm,
  activeInventoryCategoryOptions,
  activeInventoryUnitOptions,
  materialNameMaxLength,
  materialDescriptionMaxLength,
  defaultLowStockThreshold,
  defaultCriticalStockThreshold,
  submitting,
  mode = "add",
  suppliers,
  supplierIds,
  onSupplierIdsChange,
  onClose,
  onSave,
}: AddMaterialModalProps) {
  const isEditMode = mode === "edit";
  const selectedSupplierNames = suppliers.filter((entry) => supplierIds.includes(entry.supplier_id)).map((entry) => entry.supplier_name).join(", ");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <p className="font-semibold text-slate-800">
              {isEditMode ? "Edit Material" : "Add Material"}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {isEditMode
                ? "Update material details and stock alert thresholds."
                : "Add items like chicken, sauces, and other ingredients."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors text-lg"
          >
            {"\u2715"}
          </button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <FormField label="Material Name">
              <StyledInput
                type="text"
                value={rawMaterialForm.name}
                onChange={(v) =>
                  setRawMaterialForm((p) => ({
                    ...p,
                    name: sanitizeMaterialNameInput(v),
                  }))
                }
                placeholder="e.g. Whole Chicken"
                maxLength={materialNameMaxLength}
              />
            </FormField>
          </div>
          <FormField label="Category">
            <StyledSelect
              value={rawMaterialForm.category}
              onChange={(v) =>
                setRawMaterialForm((p) => ({ ...p, category: v }))
              }
            >
              <option value="" disabled>
                Select category
              </option>
              {activeInventoryCategoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </StyledSelect>
          </FormField>
          <FormField label="Unit">
            <StyledSelect
              value={rawMaterialForm.unit}
              onChange={(v) => setRawMaterialForm((p) => ({ ...p, unit: v }))}
            >
              {activeInventoryUnitOptions.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </StyledSelect>
          </FormField>
          <div className="col-span-2">
            <FormField label="Description (optional)">
              <StyledInput
                type="text"
                value={rawMaterialForm.description}
                onChange={(v) =>
                  setRawMaterialForm((p) => ({
                    ...p,
                    description: sanitizeShortTextInput(
                      v,
                      materialDescriptionMaxLength,
                    ),
                  }))
                }
                placeholder="Optional notes"
                maxLength={materialDescriptionMaxLength}
              />
            </FormField>
          </div>
          <div className="col-span-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <FormField label="Suppliers">
                <details className="relative mb-4">
                  <summary aria-disabled={submitting} onClick={(event) => { if (submitting) event.preventDefault(); }}
                    className={`flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 ${submitting ? "opacity-50" : ""}`}>
                    <span className="truncate" title={selectedSupplierNames}>{selectedSupplierNames || "Select suppliers"}</span>
                    <span aria-hidden="true" className="text-slate-400">▾</span>
                  </summary>
                  <div className="absolute left-0 right-0 z-20 mt-1 max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                    {suppliers.map((entry) => (
                      <label key={entry.supplier_id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50">
                        <input type="checkbox" disabled={submitting} checked={supplierIds.includes(entry.supplier_id)}
                          onChange={(event) => onSupplierIdsChange(event.target.checked ? [...supplierIds, entry.supplier_id] : supplierIds.filter((id) => id !== entry.supplier_id))}
                          className="accent-emerald-600" />
                        {entry.supplier_name}
                      </label>
                    ))}
                    {suppliers.length === 0 && <p className="px-2 py-2 text-sm text-slate-400">No suppliers available.</p>}
                  </div>
                </details>
              </FormField>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  Use default alert thresholds
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Turn this on to use the default warning and critical levels
                  from Settings instead of custom values for this material.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setRawMaterialForm((p) => ({
                    ...p,
                    useDefaultThresholds: !p.useDefaultThresholds,
                  }))
                }
                className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors ${
                  rawMaterialForm.useDefaultThresholds
                    ? "bg-emerald-500"
                    : "bg-slate-300"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                    rawMaterialForm.useDefaultThresholds
                      ? "translate-x-6"
                      : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField label="Warning Stock Level">
                <StyledInput
                  type="number"
                  min={0}
                  step="0.01"
                  value={rawMaterialForm.lowStockThreshold}
                  onChange={(v) =>
                    setRawMaterialForm((p) => ({
                      ...p,
                      lowStockThreshold: v,
                    }))
                  }
                  placeholder="e.g. 10"
                  disabled={rawMaterialForm.useDefaultThresholds}
                />
              </FormField>
              <FormField label="Critical Stock Level">
                <StyledInput
                  type="number"
                  min={0}
                  step="0.01"
                  value={rawMaterialForm.criticalStockThreshold}
                  onChange={(v) =>
                    setRawMaterialForm((p) => ({
                      ...p,
                      criticalStockThreshold: v,
                    }))
                  }
                  placeholder="e.g. 5"
                  disabled={rawMaterialForm.useDefaultThresholds}
                />
              </FormField>
            </div>
            {rawMaterialForm.useDefaultThresholds ? (
              <p className="mt-3 text-xs text-emerald-700">
                Using default thresholds: Warning = {defaultLowStockThreshold},
                {" "}Critical = {defaultCriticalStockThreshold}
              </p>
            ) : (
              <p className="mt-3 text-xs text-slate-500">
                Custom thresholds will be saved for this material.
              </p>
            )}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={submitting}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-60"
          >
            {submitting
              ? "Saving..."
              : isEditMode
                ? "Save Changes"
                : "Save Material"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

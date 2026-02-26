'use client';

import { useState } from 'react';

interface FieldDef {
  name: string;
  label: string;
  type: string;
  options?: string[];
  required?: boolean;
}

interface RecordFormProps {
  fields: FieldDef[];
  initialValues?: Record<string, any>;
  onSubmit: (values: Record<string, any>) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}

export function RecordForm({ fields, initialValues = {}, onSubmit, onCancel, submitLabel = 'Save' }: RecordFormProps) {
  const [values, setValues] = useState<Record<string, any>>(initialValues);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSubmit(values);
    } catch (err: any) {
      setError(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="form-error">{error}</div>}
      <div className="form-grid">
        {fields.map((f) => (
          <div key={f.name} className={f.type === 'textarea' ? 'full-width' : undefined}>
            <label className="field-label">
              {f.label}{f.required && <span style={{ color: 'var(--danger)' }}> *</span>}
            </label>
            {f.type === 'select' ? (
              <select
                className="input"
                value={values[f.name] ?? ''}
                onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                required={f.required}
              >
                <option value="">Select...</option>
                {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : f.type === 'textarea' ? (
              <textarea
                className="input"
                rows={3}
                value={values[f.name] ?? ''}
                onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                placeholder={`Enter ${f.label.toLowerCase()}...`}
              />
            ) : f.type === 'checkbox' ? (
              <div style={{ paddingTop: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!values[f.name]}
                    onChange={(e) => setValues({ ...values, [f.name]: e.target.checked })}
                    style={{ width: 18, height: 18, accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Enabled</span>
                </label>
              </div>
            ) : (
              <input
                className="input"
                type={f.type}
                value={values[f.name] ?? ''}
                onChange={(e) => setValues({
                  ...values,
                  [f.name]: f.type === 'number' ? (e.target.value ? Number(e.target.value) : '') : e.target.value,
                })}
                required={f.required}
                placeholder={`Enter ${f.label.toLowerCase()}...`}
              />
            )}
          </div>
        ))}
      </div>
      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? (
            <>
              <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
              Saving...
            </>
          ) : submitLabel}
        </button>
      </div>
    </form>
  );
}

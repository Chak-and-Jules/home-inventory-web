import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/lib/i18n/locales/en/common.json';
import tr from '@/lib/i18n/locales/tr/common.json';
import { InventoryQuantityFields } from './InventoryQuantityFields';
import { QuantityValue } from './QuantityValue';
import { QuantityInput } from './QuantityInput';

const settings = vi.hoisted(() => ({ language: 'en' }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: settings.language },
    t: (key: string, values?: Record<string, string>) => {
      const copy = settings.language === 'tr' ? tr : en;
      const text = key.split('.').reduce<unknown>((value, part) => (value as Record<string, unknown>)[part], copy) as string;
      return text.replace(/{{(\w+)}}/g, (_, part) => values?.[part] || '');
    },
  }),
}));

describe.each(['en', 'tr'])('quantity controls in %s', (language) => {
  beforeEach(() => { settings.language = language; });

  it('identifies the input unit and inherited display without offering unsavable choices', () => {
    const copy = language === 'tr' ? tr : en;
    render(<InventoryQuantityFields id="amount" value="0.8" onChange={vi.fn()} unit={{ ID: 'kg-id', Name: 'kg' }} />);
    const input = screen.getByRole('spinbutton', { name: copy.ui.quantity });
    expect(input).toHaveValue(0.8);
    expect(input).toHaveAccessibleDescription('kg');
    expect(screen.getByRole('combobox', { name: copy.ui.quantityUnit })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: copy.ui.displayUnit })).toBeDisabled();
    expect(screen.getByRole('option', { name: copy.ui.inheritDefinitionUnit.replace('{{unit}}', 'kg') })).toBeInTheDocument();
    expect(screen.getByText(copy.ui.definitionUnitHint)).toBeInTheDocument();
  });

  it('distinguishes clearing an amount from entering zero and disables saving-time edits', () => {
    const onChange = vi.fn();
    const props = { id: 'amount', value: '1', onChange };
    const { rerender } = render(<InventoryQuantityFields {...props} />);
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith('');
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '0' } });
    expect(onChange).toHaveBeenLastCalledWith('0');
    rerender(<InventoryQuantityFields {...props} disabled />);
    expect(screen.getByRole('spinbutton')).toBeDisabled();
  });

  it('formats display amounts but keeps raw editing values and identifies the quick-edit unit', () => {
    render(<><QuantityValue quantity={1300.5} unit="g" /><QuantityInput aria-label="amount" value="0.0000125" onChange={vi.fn()} unit="kg" /></>);
    expect(screen.getByText(language === 'tr' ? '1.300,5' : '1,300.5')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton')).toHaveValue(0.0000125);
    expect(screen.getByRole('spinbutton')).toHaveAccessibleDescription('kg');
    expect(screen.getByText('g')).toBeInTheDocument();
  });
});

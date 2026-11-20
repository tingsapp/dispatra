import { Button } from './ui';

export function DriverChoiceBadges<Choice extends { value: string; label: string }>({ choices, value, disabled, onSelect }: {
  choices: readonly Choice[];
  value: Choice['value'] | '';
  disabled: boolean;
  onSelect: (value: Choice['value']) => void;
}) {
  return <fieldset disabled={disabled} className="flex flex-wrap gap-1.5">
    <legend className="mb-1.5 text-xs font-medium">What is happening?</legend>
    {choices.map(choice => <Button key={choice.value} type="button" size="xs" variant={value === choice.value ? 'default' : 'outline'}
      aria-pressed={value === choice.value} onClick={() => onSelect(choice.value)}>{choice.label}</Button>)}
  </fieldset>;
}

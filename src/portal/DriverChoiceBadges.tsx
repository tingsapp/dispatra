import { Button } from './ui';

/** One choice, or several when `value` is a list (issue reports allow every reason that applies). */
export function DriverChoiceBadges<Choice extends { value: string; label: string }>({ choices, value, disabled, onSelect }: {
  choices: readonly Choice[];
  value: Choice['value'] | '' | readonly Choice['value'][];
  disabled: boolean;
  onSelect: (value: Choice['value']) => void;
}) {
  const multiple = Array.isArray(value);
  const pressed = (choice: Choice) => multiple ? value.includes(choice.value) : value === choice.value;
  return <fieldset disabled={disabled} className="flex flex-wrap gap-1.5">
    <legend className="mb-1.5 text-xs font-medium">What is happening?{multiple && <span className="ml-1 font-normal text-app-muted">Choose all that apply</span>}</legend>
    {choices.map(choice => <Button key={choice.value} type="button" size="xs" variant={pressed(choice) ? 'default' : 'outline'}
      aria-pressed={pressed(choice)} onClick={() => onSelect(choice.value)}>{choice.label}</Button>)}
  </fieldset>;
}

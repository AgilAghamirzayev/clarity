import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import type { ComponentProps, Ref } from "react";

type Props = Pick<
  ComponentProps<typeof SelectPrimitive.Root>,
  "name" | "value" | "defaultValue" | "onValueChange" | "disabled" | "required"
> & {
  options: { value: string; label: string }[];
  id?: string;
  "aria-label"?: string;
  onBlur?: () => void;
  ref?: Ref<HTMLButtonElement>;
};

export function Select({
  options,
  id,
  "aria-label": label,
  onBlur,
  ref,
  ...props
}: Props) {
  return (
    <SelectPrimitive.Root {...props}>
      <SelectPrimitive.Trigger
        className="select-trigger"
        id={id}
        aria-label={label}
        onBlur={onBlur}
        ref={ref}
      >
        <SelectPrimitive.Value />
        <SelectPrimitive.Icon asChild>
          <ChevronDown size={16} aria-hidden="true" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className="select-content"
          position="popper"
          sideOffset={6}
          collisionPadding={12}
        >
          <SelectPrimitive.ScrollUpButton className="select-scroll">
            <ChevronUp size={16} aria-hidden="true" />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="select-viewport">
            {options.map((option) => (
              <SelectPrimitive.Item
                className="select-option"
                key={option.value}
                value={option.value}
              >
                <SelectPrimitive.ItemText>
                  {option.label}
                </SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="select-check">
                  <Check size={16} aria-hidden="true" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="select-scroll">
            <ChevronDown size={16} aria-hidden="true" />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

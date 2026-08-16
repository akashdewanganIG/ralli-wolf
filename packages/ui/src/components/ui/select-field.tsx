"use client";

import * as React from "react";
import { cn } from "@repo/ui/lib/utils";
import type { ControlSize } from "@repo/ui/components/ui/form-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

const EMPTY_VALUE = "__select_field_empty__";

type SelectFieldChangeEvent = {
  target: { value: string; name?: string };
  currentTarget: { value: string; name?: string };
};

export interface SelectFieldProps
  extends Omit<
    React.SelectHTMLAttributes<HTMLSelectElement>,
    "children" | "defaultValue" | "onBlur" | "onChange" | "size" | "value"
  > {
  children: React.ReactNode;
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (event: SelectFieldChangeEvent) => void;
  onBlur?: React.FocusEventHandler<HTMLButtonElement>;
  contentClassName?: string;
  /** Height/padding/type scale. Shared with Input, Textarea and Button. */
  size?: ControlSize;
}

type SelectOption = {
  value: string;
  label: React.ReactNode;
  disabled: boolean;
};

function readOptions(children: React.ReactNode): SelectOption[] {
  const options: SelectOption[] = [];
  React.Children.forEach(children, child => {
    if (!React.isValidElement(child)) return;
    if (child.type === React.Fragment) {
      const props = child.props as { children?: React.ReactNode };
      options.push(...readOptions(props.children));
      return;
    }
    if (child.type === "option") {
      const props =
        child.props as React.OptionHTMLAttributes<HTMLOptionElement>;
      options.push({
        value: String(props.value ?? ""),
        label: props.children,
        disabled: Boolean(props.disabled),
      });
      return;
    }
    if (child.type === "optgroup") {
      const props =
        child.props as React.OptgroupHTMLAttributes<HTMLOptGroupElement>;
      options.push(...readOptions(props.children));
    }
  });
  return options;
}

export function SelectField({
  children,
  className,
  contentClassName,
  value,
  defaultValue,
  onChange,
  name,
  disabled,
  required,
  id,
  onBlur,
  size,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: SelectFieldProps) {
  const options = React.useMemo(() => readOptions(children), [children]);
  const emptyOption = options.find(option => option.value === "");
  const normalize = (next: string | number | undefined) =>
    String(next ?? "") || EMPTY_VALUE;

  return (
    <Select
      value={value === undefined ? undefined : normalize(value)}
      defaultValue={
        defaultValue === undefined ? undefined : normalize(defaultValue)
      }
      name={name}
      disabled={disabled}
      required={required}
      onValueChange={nextValue => {
        const next = nextValue === EMPTY_VALUE ? "" : nextValue;
        const event = {
          target: { value: next, name },
          currentTarget: { value: next, name },
        };
        onChange?.(event);
      }}
    >
      <SelectTrigger
        id={id}
        size={size}
        className={cn(className)}
        onBlur={onBlur}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
      >
        <SelectValue placeholder={emptyOption?.label ?? "Select an option"} />
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {options.map((option, index) => (
          <SelectItem
            key={`${option.value}-${index}`}
            value={option.value || EMPTY_VALUE}
            disabled={option.disabled}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

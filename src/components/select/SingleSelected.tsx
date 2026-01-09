import * as React from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type SingleSelectedProps = {
  selection: string[];
  value: string;
  onValueChange: (value: string) => void;

  className?: string;
  contentClassName?: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
};

export function SingleSelected({
  selection,
  value,
  onValueChange,
  className,
  contentClassName,
  label = "Model",
  placeholder = "Chọn model",
  disabled,
}: SingleSelectedProps) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={cn("w-[180px]", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>

      <SelectContent className={cn("z-[200]", contentClassName)}>
        <SelectGroup>
          <SelectLabel>{label}</SelectLabel>
          {selection.map((item) => (
            <SelectItem key={item} value={item}>
              {item}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

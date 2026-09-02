"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  /** Initial value; the input is uncontrolled afterwards. */
  defaultValue?: string;
  /** Debounced (350ms) commit of the current text. */
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}

/** Debounced search box (300ms) with a clear button. */
export function SearchInput({ defaultValue = "", onValueChange, placeholder = "Search…", className, ariaLabel }: SearchInputProps) {
  const [text, setText] = useState(defaultValue);

  // Debounce commits to the parent (fires with the initial value too — harmless no-op)
  useEffect(() => {
    const t = setTimeout(() => onValueChange(text), 300);
    return () => clearTimeout(t);
  }, [text, onValueChange]);

  return (
    <div className={cn("relative w-full sm:max-w-xs", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className="pl-8 pr-8"
      />
      {text ? (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 size-6 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={() => setText("")}
          aria-label="Clear search"
        >
          <X className="size-3.5" aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}

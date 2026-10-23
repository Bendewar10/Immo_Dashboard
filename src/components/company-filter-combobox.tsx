'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { Check, ChevronsUpDown } from 'lucide-react'

export interface CompanyOption {
  name: string
  count: number
}

interface CompanyFilterComboboxProps {
  options: CompanyOption[]
  value: string | null
  onChange: (company: string | null) => void
}

export function CompanyFilterCombobox({ options, value, onChange }: CompanyFilterComboboxProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[220px] justify-between font-normal"
        >
          <span className="truncate">{value ?? 'Firma wählen'}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0">
        <Command>
          <CommandInput placeholder="Firma suchen..." />
          <CommandList>
            <CommandEmpty>
              {options.length === 0
                ? 'Keine Firmen — Firmennamen bei Kontakten pflegen'
                : 'Keine Firma gefunden.'}
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.name}
                  value={option.name}
                  onSelect={() => {
                    onChange(option.name === value ? null : option.name)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn('mr-2 size-4', value === option.name ? 'opacity-100' : 'opacity-0')}
                  />
                  <span className="truncate">{option.name}</span>
                  <span className="ml-auto pl-2 text-xs text-muted-foreground">{option.count}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

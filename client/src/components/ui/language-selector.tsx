import { Check, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState } from "react";
import { useLanguage, languages, Language } from "@/lib/i18n";

export function LanguageSelector() {
  const { language, setLanguage, t } = useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[180px] justify-between bg-gray-800 border-gray-600 text-white hover:bg-gray-700"
        >
          <div className="flex items-center">
            <Globe className="mr-2 h-4 w-4" />
            {languages[language]}
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[180px] p-0 bg-gray-900 border-gray-700 shadow-xl z-50">
        <Command className="bg-gray-900">
          <CommandList>
            <CommandGroup>
              {Object.entries(languages).map(([code, name]) => (
                <CommandItem
                  key={code}
                  value={code}
                  onSelect={() => {
                    setLanguage(code as Language);
                    setOpen(false);
                  }}
                  className="text-white hover:bg-gray-800 data-[selected=true]:bg-gray-800 cursor-pointer"
                >
                  <Check
                    className={`mr-2 h-4 w-4 text-green-400 ${
                      language === code ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  {name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
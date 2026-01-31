import { useCurrentCompany } from '@/lib/company-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown, Building2 } from 'lucide-react';

export function CompanySwitcher() {
  const { currentCompany, setCurrentCompany, companies, isLoading } =
    useCurrentCompany();

  if (isLoading) {
    return (
      <Button
        variant="outline"
        role="combobox"
        className="w-[200px] justify-between"
        disabled
      >
        <div className="flex items-center gap-2 truncate">
          <Building2 className="h-4 w-4 shrink-0 opacity-50 animate-pulse" />
          <span className="truncate">Loading...</span>
        </div>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-[200px] justify-between"
        >
          <div className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4 shrink-0 opacity-50" />
            <span className="truncate">
              {currentCompany?.name || 'Select company...'}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[200px]">
        <DropdownMenuLabel>Companies</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {companies.length === 0 ? (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            No companies found
          </div>
        ) : (
          companies.map(company => (
            <DropdownMenuItem
              key={company._id}
              onSelect={() => setCurrentCompany(company)}
              className="flex items-center justify-between"
            >
              {company.name}
              {currentCompany?._id === company._id && (
                <Check className="h-4 w-4" />
              )}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

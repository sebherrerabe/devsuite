import React, { useEffect, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import type { Doc } from '../../../../convex/_generated/dataModel';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { showToast } from '@/lib/toast';
import { Loader2, MoreHorizontal, Pencil, Plus, Trash } from 'lucide-react';
import { CompanyRepositories } from '@/components/company-repositories';

import { TagsSettings } from '@/components/tags-settings';
import { useCurrentCompany } from '@/lib/company-context';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';

export const Route = createFileRoute('/_app/settings/company')({
  component: CompanySettingsPage,
});

function parseGithubOrgLoginsInput(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,]+/)
        .map(item => item.trim())
        .filter(Boolean)
    )
  );
}

function formatGithubOrgLoginsInput(company: Doc<'companies'> | null): string {
  if (!company?.metadata || typeof company.metadata !== 'object') {
    return '';
  }

  const value = (company.metadata as { githubOrgLogins?: unknown })
    .githubOrgLogins;
  if (!Array.isArray(value)) {
    return '';
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .join(', ');
}

function CompanySettingsPage() {
  const { currentCompany } = useCurrentCompany();
  const companies = useQuery(api.companies.list);
  const createCompany = useMutation(api.companies.create);
  const updateCompany = useMutation(api.companies.update);
  const removeCompany = useMutation(api.companies.remove);
  const defaultRateCard = useQuery(
    api.rateCards.getDefault,
    currentCompany?._id ? { companyId: currentCompany._id } : 'skip'
  );
  const setDefaultRateCard = useMutation(api.rateCards.setDefault);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] =
    useState<Doc<'companies'> | null>(null);
  const [name, setName] = useState('');
  const [githubOrgLoginsInput, setGithubOrgLoginsInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [billingRate, setBillingRate] = useState('0');
  const [billingCurrency, setBillingCurrency] = useState('USD');
  const [roundingIncrement, setRoundingIncrement] = useState('60');
  const [roundingMode, setRoundingMode] = useState<
    'floor' | 'ceil' | 'nearest'
  >('floor');
  const [isBillingSubmitting, setIsBillingSubmitting] = useState(false);

  useEffect(() => {
    if (defaultRateCard) {
      setBillingRate((defaultRateCard.hourlyRateCents / 100).toFixed(2));
      setBillingCurrency(defaultRateCard.currency);
      setRoundingIncrement(String(defaultRateCard.roundingIncrementMinutes));
      setRoundingMode(defaultRateCard.roundingMode);
    }
  }, [defaultRateCard]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await createCompany({
        name: name.trim(),
        githubOrgLogins: parseGithubOrgLoginsInput(githubOrgLoginsInput),
      });
      showToast.success('Company created successfully');
      setIsCreateOpen(false);
      setName('');
      setGithubOrgLoginsInput('');
    } catch (err) {
      showToast.error('Failed to create company');
      console.error('Error creating company:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim() || !selectedCompany) return;

    setIsSubmitting(true);
    try {
      await updateCompany({
        id: selectedCompany._id,
        name: name.trim(),
        githubOrgLogins: parseGithubOrgLoginsInput(githubOrgLoginsInput),
      });
      showToast.success('Company updated successfully');
      setIsEditOpen(false);
      setSelectedCompany(null);
      setName('');
      setGithubOrgLoginsInput('');
    } catch (err) {
      showToast.error('Failed to update company');
      console.error('Error updating company:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCompany) return;

    setIsSubmitting(true);
    try {
      await removeCompany({ id: selectedCompany._id });
      showToast.success('Company deleted successfully');
      setIsDeleteOpen(false);
      setSelectedCompany(null);
    } catch (err) {
      showToast.error('Failed to delete company');
      console.error('Error deleting company:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEdit = (company: Doc<'companies'>) => {
    setSelectedCompany(company);
    setName(company.name);
    setGithubOrgLoginsInput(formatGithubOrgLoginsInput(company));
    setIsEditOpen(true);
  };

  const openDelete = (company: Doc<'companies'>) => {
    setSelectedCompany(company);
    setIsDeleteOpen(true);
  };

  const handleBillingSave = async () => {
    if (!currentCompany) return;
    const rateCents = Math.round(Number(billingRate) * 100);
    const rounding = Number(roundingIncrement);
    if (!Number.isFinite(rateCents) || rateCents < 0) {
      showToast.error('Hourly rate must be a valid number');
      return;
    }
    if (!Number.isFinite(rounding) || rounding <= 0) {
      showToast.error('Rounding increment must be a positive number');
      return;
    }

    setIsBillingSubmitting(true);
    try {
      await setDefaultRateCard({
        companyId: currentCompany._id,
        hourlyRateCents: rateCents,
        currency: billingCurrency.trim().toUpperCase(),
        roundingIncrementMinutes: rounding,
        roundingMode,
      });
      showToast.success('Billing defaults updated');
    } catch (error) {
      showToast.error(
        error instanceof Error ? error.message : 'Failed to update billing'
      );
    } finally {
      setIsBillingSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Companies</h3>
          <p className="text-sm text-muted-foreground">
            Manage your companies and settings.
          </p>
        </div>
        <Button
          onClick={() => {
            setName('');
            setGithubOrgLoginsInput('');
            setIsCreateOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Company
        </Button>
      </div>

      <div className="h-px bg-border" />

      {companies === undefined ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : companies.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center space-y-2 border border-dashed rounded-lg">
          <p className="text-muted-foreground">No companies found</p>
          <Button variant="outline" onClick={() => setIsCreateOpen(true)}>
            Create your first company
          </Button>
        </div>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map(company => (
                <TableRow key={company._id}>
                  <TableCell className="font-medium">{company.name}</TableCell>
                  <TableCell>
                    {new Intl.DateTimeFormat('en-US', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(company.createdAt))}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(company)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => openDelete(company)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Company</DialogTitle>
            <DialogDescription>
              Add a new company to manage your projects and tasks.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="name"
                placeholder="Acme Inc."
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="create-org-logins"
                className="text-sm font-medium"
              >
                GitHub org logins (optional)
              </label>
              <Input
                id="create-org-logins"
                placeholder="acme-org, acme-platform"
                value={githubOrgLoginsInput}
                onChange={e => setGithubOrgLoginsInput(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Used to route GitHub notifications into this company inbox.
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateOpen(false);
                  setGithubOrgLoginsInput('');
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !name.trim()}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Edit Company</DialogTitle>
            <DialogDescription>
              Update the name of your company.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="edit-name" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="edit-name"
                placeholder="Acme Inc."
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="edit-org-logins" className="text-sm font-medium">
                GitHub org logins (optional)
              </label>
              <Input
                id="edit-org-logins"
                placeholder="acme-org, acme-platform"
                value={githubOrgLoginsInput}
                onChange={e => setGithubOrgLoginsInput(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated org logins used for GitHub notification routing.
              </p>
            </div>
            {selectedCompany && (
              <CompanyRepositories companyId={selectedCompany._id} />
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditOpen(false);
                  setGithubOrgLoginsInput('');
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !name.trim()}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Company</DialogTitle>
            <DialogDescription className="text-destructive">
              Are you sure you want to delete{' '}
              <strong>{selectedCompany?.name}</strong>? This action will remove
              the company from your list.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isSubmitting}
            >
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {currentCompany && (
        <>
          <Separator className="my-8" />
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium">
                Current Company: {currentCompany.name}
              </h3>
              <p className="text-sm text-muted-foreground">
                Manage settings specific to your currently active company.
              </p>
            </div>

            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
              <TagsSettings companyId={currentCompany._id} />
            </div>

            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 space-y-4">
              <div>
                <h4 className="text-base font-semibold">Billing Defaults</h4>
                <p className="text-sm text-muted-foreground">
                  Configure the default hourly rate and rounding policy.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Hourly rate</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={billingRate}
                    onChange={e => setBillingRate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Input
                    value={billingCurrency}
                    onChange={e => setBillingCurrency(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rounding increment (minutes)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={roundingIncrement}
                    onChange={e => setRoundingIncrement(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rounding mode</Label>
                  <Select
                    value={roundingMode}
                    onValueChange={value =>
                      setRoundingMode(value as 'floor' | 'ceil' | 'nearest')
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="floor">Floor</SelectItem>
                      <SelectItem value="nearest">Nearest</SelectItem>
                      <SelectItem value="ceil">Ceil</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleBillingSave}
                  disabled={isBillingSubmitting}
                >
                  {isBillingSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Billing Defaults
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

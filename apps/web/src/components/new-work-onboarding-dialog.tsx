"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api, type WorkspaceSearchResult } from "@/lib/api";
import { SERVICE_LINE_TEMPLATES } from "@/lib/service-line-templates";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WorkspaceSearchCombobox } from "@/components/workspace-search-combobox";

type NewWorkOnboardingDialogProps = {
  open: boolean;
  onClose: () => void;
  token: string;
  title?: string;
  description?: string;
};

export function NewWorkOnboardingDialog({
  open,
  onClose,
  token,
  title = "New work for existing client",
  description = "Search for an existing client workspace and create a new project under it.",
}: NewWorkOnboardingDialogProps) {
  const queryClient = useQueryClient();
  const [workspace, setWorkspace] = useState<WorkspaceSearchResult | null>(null);
  const [projectName, setProjectName] = useState("");
  const [serviceLine, setServiceLine] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setWorkspace(null);
      setProjectName("");
      setServiceLine("");
      setError("");
    }
  }, [open]);

  useEffect(() => {
    if (workspace?.serviceLine && !serviceLine) {
      setServiceLine(workspace.serviceLine);
    }
  }, [workspace, serviceLine]);

  const createMutation = useMutation({
    mutationFn: () =>
      api.createWorkspaceProject(token, workspace!.id, {
        name: projectName.trim(),
        serviceLine: serviceLine || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  const serviceLineOptions = Object.keys(SERVICE_LINE_TEMPLATES);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-1">
            <Label>Client</Label>
            <WorkspaceSearchCombobox
              token={token}
              value={workspace}
              onChange={setWorkspace}
              disabled={createMutation.isPending}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="project-name">Project name</Label>
            <Input
              id="project-name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. Q3 Social Campaign"
              disabled={createMutation.isPending}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="service-line">Service line (optional)</Label>
            <select
              id="service-line"
              value={serviceLine}
              onChange={(e) => setServiceLine(e.target.value)}
              className="w-full rounded-lg border bg-white/50 px-3 py-2 text-sm"
              disabled={createMutation.isPending}
            >
              <option value="">Use workspace default</option>
              {serviceLineOptions.map((line) => (
                <option key={line} value={line}>
                  {line}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose} disabled={createMutation.isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => createMutation.mutate()}
            disabled={!workspace || !projectName.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? "Creating…" : "Create project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

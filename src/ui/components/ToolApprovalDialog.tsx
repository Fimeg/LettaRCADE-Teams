import { useState, useCallback } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from "./ui/composites/Modal";
import { Button } from "./ui/primitives/Button";
import type { PermissionRequest } from "../store/useAppStore";

interface ToolApprovalDialogProps {
  /** The permission request to display, or null to hide the dialog */
  request: PermissionRequest | null;
  /** Called with true to allow, false to deny */
  onRespond: (allow: boolean) => void;
}

/**
 * Modal dialog that asks the user to approve or deny a tool invocation.
 * Shows the tool name, arguments preview, and Allow/Deny buttons.
 * Closes immediately on either action — the parent controls visibility.
 */
export function ToolApprovalDialog({ request, onRespond }: ToolApprovalDialogProps) {
  const [remember, setRemember] = useState(false);
  const handleAllow = useCallback(() => {
    onRespond(true);
  }, [onRespond]);

  const handleDeny = useCallback(() => {
    onRespond(false);
  }, [onRespond]);

  // Format input for display — truncate long strings
  const formatInput = (input: unknown): string => {
    if (typeof input === "string") return input.length > 500 ? input.slice(0, 500) + "…" : input;
    try {
      const text = JSON.stringify(input, null, 2);
      return text.length > 1000 ? text.slice(0, 1000) + "\n…" : text;
    } catch {
      return String(input);
    }
  };

  if (!request) return null;

  return (
    <Modal key={request.toolUseId} open={true} onOpenChange={(open) => { if (!open) onRespond(false); }}>
      <ModalContent size="xl">
        <ModalHeader>
          <ModalTitle>
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Tool Approval Required
            </span>
          </ModalTitle>
          <ModalDescription>
            The agent wants to run <strong className="text-ink-900">{request.toolName}</strong>.
            Review the arguments below before approving.
          </ModalDescription>
        </ModalHeader>

        {/* Tool arguments */}
        <div className="mt-3">
          <div className="text-xs font-medium text-ink-500 mb-1 uppercase tracking-wide">Arguments</div>
          <pre className="bg-ink-900/5 border border-ink-900/10 rounded-lg p-3 text-xs font-mono text-ink-700 overflow-auto max-h-48 whitespace-pre-wrap break-all">
            {formatInput(request.input)}
          </pre>
        </div>

        {/* Remember choice */}
        <label className="flex items-center gap-2 mt-4 text-sm text-ink-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="rounded border-ink-300 text-accent focus:ring-accent/50"
          />
          Remember my choice for this session
        </label>

        <ModalFooter>
          <Button
            variant="secondary"
            size="md"
            onClick={handleDeny}
          >
            Deny
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleAllow}
          >
            Allow
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

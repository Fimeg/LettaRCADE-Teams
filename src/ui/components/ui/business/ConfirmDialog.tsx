import { useEffect, useState } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from '../composites/Modal';
import { Button } from '../primitives/Button';
import { Input } from '../primitives/Input';
import { Label } from '../primitives/Label';

export interface ConfirmDialogProps {
  /** Controlled open state */
  open: boolean;

  /** Dialog title displayed in header */
  title: string;

  /** Message content - supports newlines via whitespace-pre-line */
  message: string;

  /** Label for confirm button (default: "Confirm") */
  confirmLabel?: string;

  /** Label for cancel button (default: "Cancel") */
  cancelLabel?: string;

  /** Visual variant - affects confirm button styling */
  variant?: 'danger' | 'default';

  /** If set, user must type this exact string before confirm is enabled */
  requireTyped?: string;

  /** Loading state - disables buttons and shows spinner on confirm */
  busy?: boolean;

  /** Callback when user confirms the action */
  onConfirm: () => void;

  /** Callback when user cancels (backdrop click, escape, cancel button) */
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  requireTyped,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');

  // Reset typed text when dialog closes
  useEffect(() => {
    if (!open) setTyped('');
  }, [open]);

  const canConfirm = !busy && (!requireTyped || typed === requireTyped);

  return (
    <Modal open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <ModalContent size="md">
        <ModalHeader>
          <ModalTitle>{title}</ModalTitle>
          <ModalDescription className="whitespace-pre-line">
            {message}
          </ModalDescription>
        </ModalHeader>

        {requireTyped && (
          <div className="mt-4">
            <Label size="sm">
              Type <span className="font-mono text-ink-900">{requireTyped}</span> to confirm:
            </Label>
            <Input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoFocus
              disabled={busy}
              size="md"
            />
          </div>
        )}

        <ModalFooter>
          <Button
            variant="secondary"
            size="md"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            size="md"
            onClick={onConfirm}
            disabled={!canConfirm}
            isLoading={busy}
          >
            {confirmLabel}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default ConfirmDialog;

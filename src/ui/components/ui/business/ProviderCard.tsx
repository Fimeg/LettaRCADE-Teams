import * as React from 'react';
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Edit2,
  Trash2,
  Cloud,
  Cpu,
  Zap,
  Server,
  type LucideIcon
} from 'lucide-react';
import { Card, CardHeader, CardFooter, CardTitle, type CardProps } from '../composites/Card';
import { Button } from '../primitives/Button';
import { FormField } from '../composites/FormField';
import { Input } from '../primitives/Input';
import { cn } from '../../../utils/cn';
import type { Provider, ProviderType, ProviderCategory } from '../../../services/api';

// ============================================================================
// TYPES
// ============================================================================

export type ProviderStatus = 'connected' | 'disconnected' | 'error' | 'syncing';

export interface ProviderStatusInfo {
  status: ProviderStatus;
  message?: string;
  lastSyncedAt?: string | null;
  errorDetails?: string;
}

export interface ProviderCardProps extends CardProps {
  provider: Provider;
  status: ProviderStatusInfo;
  onEdit?: (provider: Provider) => void;
  onDelete?: (provider: Provider) => void;
  onRefresh?: (provider: Provider) => void;
  showActions?: boolean;
  showRefresh?: boolean;
  showCategoryBadge?: boolean;
  isEditing?: boolean;
  onSaveEdit?: (updates: Partial<Provider>) => Promise<void>;
  onCancelEdit?: () => void;
  isRefreshing?: boolean;
  isDeleting?: boolean;
  renderIcon?: (providerType: ProviderType) => React.ReactNode;
  renderActions?: (provider: Provider, status: ProviderStatus) => React.ReactNode;
}

export interface ProviderTypeMeta {
  type: ProviderType;
  label: string;
  icon: LucideIcon;
  color: string;
  needsBaseUrl: boolean;
  isLocal: boolean;
}

// ============================================================================
// STATUS CONFIGURATION
// ============================================================================

export const STATUS_VARIANTS: Record<ProviderStatus, {
  dotColor: string;
  bgColor: string;
  borderColor: string;
  label: string;
  icon: LucideIcon;
}> = {
  connected: {
    dotColor: 'bg-green-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    label: 'Connected',
    icon: CheckCircle2,
  },
  disconnected: {
    dotColor: 'bg-gray-300',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    label: 'Disconnected',
    icon: Circle,
  },
  error: {
    dotColor: 'bg-red-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    label: 'Error',
    icon: AlertCircle,
  },
  syncing: {
    dotColor: 'bg-amber-500 animate-pulse',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    label: 'Syncing',
    icon: Loader2,
  },
};

// ============================================================================
// CATEGORY STYLES
// ============================================================================

export const CATEGORY_STYLES: Record<ProviderCategory, {
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  pillColor: string;
}> = {
  base: {
    badgeBg: 'bg-green-100',
    badgeText: 'text-green-700',
    badgeBorder: 'border-green-200',
    pillColor: 'bg-green-400',
  },
  byok: {
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
    badgeBorder: 'border-amber-200',
    pillColor: 'bg-amber-400',
  },
};

// ============================================================================
// PROVIDER METADATA
// ============================================================================

export const PROVIDER_TYPE_META: Partial<Record<ProviderType, ProviderTypeMeta>> = {
  anthropic: {
    type: 'anthropic',
    label: 'Anthropic',
    icon: Cloud,
    color: 'bg-orange-500',
    needsBaseUrl: false,
    isLocal: false,
  },
  openai: {
    type: 'openai',
    label: 'OpenAI',
    icon: Zap,
    color: 'bg-emerald-500',
    needsBaseUrl: false,
    isLocal: false,
  },
  azure: {
    type: 'azure',
    label: 'Azure OpenAI',
    icon: Cloud,
    color: 'bg-blue-500',
    needsBaseUrl: true,
    isLocal: false,
  },
  ollama: {
    type: 'ollama',
    label: 'Ollama',
    icon: Cpu,
    color: 'bg-purple-500',
    needsBaseUrl: true,
    isLocal: true,
  },
  groq: {
    type: 'groq',
    label: 'Groq',
    icon: Zap,
    color: 'bg-pink-500',
    needsBaseUrl: false,
    isLocal: false,
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function formatLastSynced(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function maskApiKey(apiKey: string | null): string {
  if (!apiKey) return '••••••••';
  if (apiKey.length <= 8) return '••••••••';
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const StatusDot = React.forwardRef<HTMLSpanElement, { status: ProviderStatus; className?: string }>(
  ({ status, className }, ref) => {
    const config = STATUS_VARIANTS[status];
    const IconComponent = config.icon;

    return (
      <span
        ref={ref}
        className={cn('flex items-center gap-1.5', className)}
        role="status"
        aria-live="polite"
      >
        <span className={cn('relative flex h-2.5 w-2.5', status === 'syncing' && 'animate-pulse')}>
          <span className={cn('relative inline-flex rounded-full h-2.5 w-2.5', config.dotColor)} />
        </span>
        <IconComponent className={cn('h-3.5 w-3.5',
          status === 'connected' && 'text-green-500',
          status === 'disconnected' && 'text-gray-400',
          status === 'error' && 'text-red-500',
          status === 'syncing' && 'text-amber-500 animate-spin'
        )} />
        <span className="text-xs font-medium text-ink-600">{config.label}</span>
      </span>
    );
  }
);
StatusDot.displayName = 'StatusDot';

const ProviderIcon = React.forwardRef<HTMLDivElement, { providerType: ProviderType; className?: string }>(
  ({ providerType, className }, ref) => {
    const meta = PROVIDER_TYPE_META[providerType];
    const IconComponent = meta?.icon || Server;
    const colorClass = meta?.color || 'bg-gray-500';

    return (
      <div
        ref={ref}
        className={cn(
          'h-10 w-10 rounded-lg flex items-center justify-center text-white',
          colorClass,
          className
        )}
      >
        <IconComponent className="h-5 w-5" />
      </div>
    );
  }
);
ProviderIcon.displayName = 'ProviderIcon';

const CategoryBadge = React.forwardRef<HTMLSpanElement, { category: ProviderCategory; className?: string }>(
  ({ category, className }, ref) => {
    const styles = CATEGORY_STYLES[category];

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
          styles.badgeBg,
          styles.badgeText,
          styles.badgeBorder,
          className
        )}
      >
        {category === 'byok' ? 'BYOK' : 'Base'}
      </span>
    );
  }
);
CategoryBadge.displayName = 'CategoryBadge';

// ============================================================================
// INLINE EDIT FORM
// ============================================================================

const InlineEditForm: React.FC<{
  provider: Provider;
  onSave: (updates: Partial<Provider>) => Promise<void>;
  onCancel: () => void;
}> = ({ provider, onSave, onCancel }) => {
  const [name, setName] = React.useState(provider.name);
  const [baseUrl, setBaseUrl] = React.useState(provider.base_url || '');
  const [isSaving, setIsSaving] = React.useState(false);

  const meta = PROVIDER_TYPE_META[provider.provider_type];
  const needsBaseUrl = meta?.needsBaseUrl ?? false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updates: Partial<Provider> = { name: name.trim() };
      if (needsBaseUrl && baseUrl.trim()) {
        updates.base_url = baseUrl.trim();
      }
      await onSave(updates);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 bg-surface-secondary rounded-lg border border-ink-900/10">
      <FormField label="Name" htmlFor="provider-name">
        <Input
          id="provider-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Provider name"
        />
      </FormField>

      {needsBaseUrl && (
        <FormField
          label="Base URL"
          htmlFor="provider-baseurl"
          helperText="Custom API endpoint (optional)"
        >
          <Input
            id="provider-baseurl"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.example.com"
          />
        </FormField>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          isLoading={isSaving}
        >
          Save
        </Button>
      </div>
    </form>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const ProviderCard = React.forwardRef<HTMLDivElement, ProviderCardProps>(
  ({
    provider,
    status,
    onEdit,
    onDelete,
    onRefresh,
    showActions = true,
    showRefresh,
    showCategoryBadge = true,
    isEditing = false,
    onSaveEdit,
    onCancelEdit,
    isRefreshing = false,
    isDeleting = false,
    renderIcon,
    renderActions,
    className,
    variant = 'hoverable',
    ...props
  }, ref) => {
    const [showConfirmDelete, setShowConfirmDelete] = React.useState(false);

    const isByok = provider.provider_category === 'byok';
    const shouldShowRefresh = showRefresh ?? isByok;

    const typeMeta = PROVIDER_TYPE_META[provider.provider_type];
    const typeLabel = typeMeta?.label || provider.provider_type;

    const handleDeleteClick = () => {
      if (showConfirmDelete) {
        onDelete?.(provider);
        setShowConfirmDelete(false);
      } else {
        setShowConfirmDelete(true);
      }
    };

    const handleCancelDelete = () => {
      setShowConfirmDelete(false);
    };

    return (
      <Card
        ref={ref}
        variant={isEditing ? 'selected' : variant}
        className={cn(
          'group relative',
          status.status === 'error' && 'border-red-200',
          className
        )}
        role="article"
        aria-label={`${provider.name} provider card`}
        {...props}
      >
        <CardHeader className="pb-3">
          {isEditing && onSaveEdit && onCancelEdit ? (
            <InlineEditForm
              provider={provider}
              onSave={onSaveEdit}
              onCancel={onCancelEdit}
            />
          ) : (
            <div className="flex items-start justify-between gap-4">
              {/* Left: Icon + Info */}
              <div className="flex items-start gap-3 min-w-0 flex-1">
                {renderIcon ? (
                  renderIcon(provider.provider_type)
                ) : (
                  <ProviderIcon providerType={provider.provider_type} />
                )}

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-base font-semibold text-ink-900 truncate">
                      {provider.name}
                    </CardTitle>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-surface-tertiary text-ink-600 border border-ink-900/10">
                      {typeLabel}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <StatusDot status={status.status} />
                    {status.message && (
                      <span className="text-xs text-ink-500">{status.message}</span>
                    )}
                  </div>

                  <div className="text-xs text-ink-500 flex items-center gap-2 flex-wrap">
                    <span>Last synced: {formatLastSynced(status.lastSyncedAt ?? provider.last_synced)}</span>
                    {provider.base_url && (
                      <span className="font-mono text-ink-400 truncate max-w-[200px]">
                        {provider.base_url}
                      </span>
                    )}
                    {isByok && provider.api_key && (
                      <span className="text-ink-400">Key: {maskApiKey(provider.api_key)}</span>
                    )}
                  </div>

                  {status.status === 'error' && status.errorDetails && (
                    <p className="text-xs text-red-600 mt-1" role="alert">
                      {status.errorDetails}
                    </p>
                  )}
                </div>
              </div>

              {showCategoryBadge && (
                <CategoryBadge category={provider.provider_category} />
              )}
            </div>
          )}
        </CardHeader>

        {!isEditing && showActions && !renderActions && (
          <CardFooter className="pt-0 justify-end">
            <div
              className={cn(
                'flex items-center gap-1 transition-opacity',
                'opacity-0 group-hover:opacity-100',
                (isRefreshing || isDeleting || showConfirmDelete) && 'opacity-100'
              )}
            >
              {showConfirmDelete ? (
                <>
                  <span className="text-xs text-red-600 mr-2">Delete this provider?</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelDelete}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    isLoading={isDeleting}
                    onClick={handleDeleteClick}
                  >
                    Confirm
                  </Button>
                </>
              ) : (
                <>
                  {shouldShowRefresh && onRefresh && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      isLoading={isRefreshing}
                      onClick={() => onRefresh(provider)}
                      aria-label={`Refresh ${provider.name}`}
                      title="Refresh model list"
                    >
                      <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
                    </Button>
                  )}

                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onEdit(provider)}
                      aria-label={`Edit ${provider.name}`}
                      title="Edit provider"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}

                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={handleDeleteClick}
                      aria-label={`Delete ${provider.name}`}
                      title="Delete provider"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </>
              )}
            </div>
          </CardFooter>
        )}

        {!isEditing && renderActions && (
          <CardFooter className="pt-0 justify-end">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              {renderActions(provider, status.status)}
            </div>
          </CardFooter>
        )}
      </Card>
    );
  }
);

ProviderCard.displayName = 'ProviderCard';

export { ProviderCard };
export default ProviderCard;

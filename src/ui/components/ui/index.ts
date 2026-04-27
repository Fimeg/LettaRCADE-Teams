// Primitive components
export {
  Button,
  buttonVariants,
  type ButtonProps,
} from './primitives/Button';

export {
  Input,
  inputVariants,
  type InputProps,
} from './primitives/Input';

export {
  Label,
  labelVariants,
  type LabelProps,
} from './primitives/Label';

export {
  Spinner,
  spinnerVariants,
  type SpinnerProps,
} from './primitives/Spinner';

export {
  Icon,
  iconVariants,
  type IconProps,
  // Re-export all Lucide icons
} from './primitives/Icon';

// Composite components
export {
  Alert,
  alertVariants,
  type AlertProps,
} from './composites/Alert';

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  cardVariants,
  type CardProps,
} from './composites/Card';

export {
  FormField,
  formFieldVariants,
  type FormFieldProps,
} from './composites/FormField';

export {
  Modal,
  ModalPortal,
  ModalOverlay,
  ModalTrigger,
  ModalClose,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalTitle,
  ModalDescription,
  ModalCloseButton,
} from './composites/Modal';

// Business components (domain-aware)
export * from './business';

// Pattern components (complex organisms)
export * from './patterns';

// Design tokens
export * from '../../theme/tokens';

// Utilities
export { cn } from '../../utils/cn';

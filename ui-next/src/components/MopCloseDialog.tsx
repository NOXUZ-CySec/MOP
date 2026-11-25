import { LogOut } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type MopCloseDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onReturnFocus: () => void;
};

export function MopCloseDialog({
  open, onOpenChange, onConfirm, onReturnFocus,
}: MopCloseDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="mop-shadcn-close"
        overlayClassName="mop-shadcn-close-overlay"
        aria-labelledby="mop68-close-title"
        aria-describedby="mop68-close-desc"
        onEscapeKeyDown={(event) => event.stopPropagation()}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onReturnFocus();
        }}
      >
        <AlertDialogHeader>
          <span className="mop-shadcn-close-icon" aria-hidden="true">
            <LogOut size={22} />
          </span>
          <AlertDialogTitle id="mop68-close-title">
            Encerrar o MOP?
          </AlertDialogTitle>
          <AlertDialogDescription id="mop68-close-desc">
            Deseja fechar a ferramenta? Verifique se concluiu os registros
            e a passagem de turno antes de sair.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel type="button">Cancelar</AlertDialogCancel>
          <AlertDialogAction
            type="button"
            variant="destructive"
            onClick={onConfirm}
          >
            Confirmar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

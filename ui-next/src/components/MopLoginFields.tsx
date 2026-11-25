import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type MopLoginFieldsProps = {
  login: string;
  password: string;
  reveal: boolean;
  busy: boolean;
  errorId?: string;
  onLoginChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onRevealToggle: () => void;
};

export function MopLoginFields({
  login, password, reveal, busy, errorId,
  onLoginChange, onPasswordChange, onRevealToggle,
}: MopLoginFieldsProps) {
  return (
    <div className="mop-login-fields">
      <div className="mop-login-field">
        <Label htmlFor="mop-login-username">Usuário ou e-mail</Label>
        <Input
          id="mop-login-username"
          name="username"
          value={login}
          onChange={(event) => onLoginChange(event.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={254}
          placeholder="Usuário ou e-mail"
          disabled={busy}
          aria-describedby={errorId}
        />
      </div>
      <div className="mop-login-field">
        <Label htmlFor="mop-login-password">Senha</Label>
        <div className="mop-login-secret">
          <Input
            id="mop-login-password"
            name="password"
            type={reveal ? "text" : "password"}
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            autoComplete="current-password"
            required
            placeholder="Sua senha"
            disabled={busy}
            aria-describedby={errorId}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="mop-login-reveal"
            onClick={onRevealToggle}
            aria-label={reveal ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={reveal}
            disabled={busy}
          >
            {reveal ? <EyeOff size={17} /> : <Eye size={17} />}
          </Button>
        </div>
      </div>
    </div>
  );
}

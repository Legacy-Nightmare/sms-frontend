import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-field">
      <input {...props} type={visible ? "text" : "password"} />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff /> : <Eye />}
      </button>
    </div>
  );
}

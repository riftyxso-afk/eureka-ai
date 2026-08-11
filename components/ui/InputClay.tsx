import type { InputHTMLAttributes } from "react";

interface InputClayProps extends InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export default function InputClay({ className = "", ...rest }: InputClayProps) {
  return <input className={`input-clay ${className}`} {...rest} />;
}

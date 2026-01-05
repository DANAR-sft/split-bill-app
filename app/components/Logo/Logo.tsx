import React from "react";
import Link from "next/link";

interface LogoProps {
  href?: string;
  sizeClass?: string;
}

export default function Logo({
  href = "/",
  sizeClass = "w-10 h-10",
}: LogoProps) {
  const content = (
    <div
      className={`${sizeClass} rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white font-semibold shadow-lg shadow-indigo-500/20`}
    >
      SB
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

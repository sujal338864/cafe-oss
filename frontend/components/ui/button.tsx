"use client"

import React from "react"

export function Button({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`px-4 py-2 rounded-md border border-slate-700 bg-slate-800 text-white hover:bg-slate-700 ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

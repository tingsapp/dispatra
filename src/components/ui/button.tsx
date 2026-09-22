import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"
import { Slot } from "@radix-ui/react-slot"

const buttonVariants = cva(
  "app-button inline-flex shrink-0 items-center justify-center gap-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-rose-600 aria-invalid:ring-rose-600/20 dark:aria-invalid:ring-rose-600/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "app-primary bg-slate-900 text-white hover:bg-slate-900/90",
        destructive:
          "bg-rose-600 text-white hover:bg-rose-600/90 focus-visible:ring-rose-600/20 dark:bg-rose-600/60 dark:focus-visible:ring-rose-600/40",
        outline:
          "app-secondary border bg-white hover:bg-slate-100 hover:text-slate-900",
        secondary:
          "bg-slate-100 text-slate-900 hover:bg-slate-100/80",
        ghost:
          "hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-100/50",
        link: "text-slate-900 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-full px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 rounded-full px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-full px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-full [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
